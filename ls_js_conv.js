//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// SCRIPT DESCRIPTION
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
This script converts each screenshot (ss) and json collected from the initial web crawl into a form manageable for Label Studio. It iterates
through each run in site_data and convert to a Label Studio ready form and dumps the coverted files into the json folder in the ls_data
directory. It also copies over all the ss to the ss folder in the ls_data directory. 
*/ 



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// REQUIRED MODULES
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const fs = require('fs')
// Node-Canvas Package for image creation and manipulation
// https://www.npmjs.com/package/canvas
const sizeOf = require('image-size')
const randomstring = require("randomstring");



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// Defining Paths
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Paths can be found from the default.yaml in the config dir

// const proj_paths = config.get('proj_paths')
// const server_info = config.get('server_info')
// const label_studio_info = config.get('label_studio_info')

// let out_path = proj_paths.ls_data_rel
// let base_dir = proj_paths.site_data_rel
// let server_ls_json_ss_link_path = proj_paths.server_ls_json_ss_link_path

// let host = server_info.host
// let port = server_info.port
// let path = proj_paths.server_ls_tasks_api

// let token = label_studio_info.token

// let url_ = "http://" + host + ":" + port + path

// console.log(url_)

//// Using environment variable in docker version for greater convience in simultaneous upload situations

let out_path = process.env.LS_DOCKER_LS_DATA_REL
let base_dir = process.env.LS_DOCKER_SITE_DATA_REL
let server_ls_json_ss_link_path = process.env.LS_DOCKER_SERVER_LS_JSON_SS_LINK_PATH

let host = process.env.LS_DOCKER_HOST
let port = process.env.LS_DOCKER_HOST_PORT
let path = process.env.LS_DOCKER_SERVER_LS_TASKS_API

let url_ = "http://" + host + ":" + port + path

console.log(url_)

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// HELPER FUNTIONS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Syncronous sleep function implemetation
function sleep(ms) {
    var start = new Date().getTime()
    var expire = start + ms;
    while (new Date().getTime() < expire) { }
    return;
}

function getTimeStamp() {
    const timestamp = new Date().toISOString();
    return timestamp    
}

// Function generates and returns a list of subdirectories in particular directory
function get_subdir_from_dir (dir_path) {

    let subdir_list = []

    try {
        subdir_list = fs.readdirSync(dir_path);
    } catch (err) {
        console.error(err)
    }

    return subdir_list

}

function getRandStr (length) {
    const rs = randomstring.generate(length);
    return rs
}

// Function that draw bounding boxes around each page element associated with a given image
function convert_to_ls_form (img_width, img_height, data, og_img, out_path, common_name) {

    const result = []

    final_path = out_path + "json/" + common_name + ".json"
    // console.log(final_path)

    for (let i = 0; i < data.length; i++) {

        // console.log(data[i])

        result.push({

            "id": getRandStr(16),
            "type": "rectanglelabels",

            "value": {
				"x": (data[i].coords.x / img_width) * 100,
				"y": (data[i].coords.y / img_height) * 100,
				"width": (data[i].coords.width / img_width) * 100,
				"height": (data[i].coords.height / img_height) * 100,
				"rotation": 0,
				"rectanglelabels": [
				data[i].label
				]
            },

            "origin": "manual", 
            "to_name": "image",
            "from_name": "label",
            "image_rotation": 0,
            "original_width": img_width,
            "original_height": img_height,

        })

        // bounding_box = data[i].coords
        // label = data[i].tag

    }

    time = getTimeStamp()

    const final_json = {

        "data": {
			"image": "/data/local-files/?d=" + server_ls_json_ss_link_path + common_name + ".png"
        },
        "annotations": [
			{
				result
			}
        ],
        "predictions": []

      }

    // console.log(final_json)

    fs.writeFileSync(final_path, JSON.stringify(final_json))

}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// DRIVER FUNTION
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function main_driver () {

	console.log("Converting json to Label Studio format...")

	const subdir_list = get_subdir_from_dir(base_dir)

	// Iterate through site_data 
	subdir_list.forEach( (subdir) => {

		// index++      
		
		// Generating common name for both json and image
		rand_str = getRandStr(16)

		const run_list = get_subdir_from_dir(base_dir + "/" + subdir)

		uniq_name = ""

		run_list.forEach ((filename)  => {

			if (filename.split(".")[1] == "png") {
				uniq_name = filename.split(".")[0].split("_")[0]
			}

		})

		common_name = rand_str + "-" + uniq_name + "_ss"

		// console.log(index)
		
		let inc = subdir.split("_")[1]

		// Extracting screen shot that corresponds the json and outputting to ls_data directory
		let ss_img = fs.readFileSync(`${base_dir}${subdir}/${uniq_name}_ss_${inc}.png`)
		fs.writeFileSync(out_path + "ss/"+ common_name + ".png", ss_img) 
		
		// Converting old json output to LS formatted json and outputting to ls_data directory
		const dimensions = sizeOf(`${base_dir}${subdir}/${uniq_name}_ss_${inc}.png`)
		const og_width = dimensions.width
		const og_height = dimensions.height

		let data_raw = fs.readFileSync(`${base_dir}${subdir}/elems_${inc}.json`)
		let data = JSON.parse(data_raw)

		var og_img = `${base_dir}${subdir}/ss_${inc}.png`

		convert_to_ls_form(og_width, og_height, data, og_img, out_path, common_name)

	})  

}

main_driver ()