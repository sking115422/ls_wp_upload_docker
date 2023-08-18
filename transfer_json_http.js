//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// SCRIPT DESCRIPTION
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
This script transfers the Label Studio ready json to the label studio web app on the server via an API call. All files in the 
ls_data/json directory will be uploaded. It will upload in batches. The batch size can be adjusted in the config/default.yaml file by
changing the "upload_json_batch_size" parameter. By default is set to 10 because that seems to be fairly optimal.
*/ 



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// REQUIRED MODULES
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const fs = require('fs')
const axios = require('axios');



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// DEFINING PATHS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Paths can be found from the default.yaml in the config dir

// const server_info = config.get('server_info')
// const label_studio_info = config.get('label_studio_info')
// const proj_paths = config.get('proj_paths')
// const upload_params = config.get('upload_parameters') 

// let base_path_lsdata = proj_paths.ls_data_rel

// let host = server_info.host
// let port = server_info.port
// let path = proj_paths.server_ls_import_api

// let token = label_studio_info.token

// let upload_batch_size = upload_params.upload_json_batch_size

//// Using environment variable in docker version for greater convience in simultaneous upload situations

let base_path_lsdata = process.env.LS_DOCKER_LS_DATA_REL

let host = process.env.LS_DOCKER_HOST
let port = process.env.LS_DOCKER_HOST_PORT
let path = process.env.LS_DOCKER_SERVER_LS_IMPORT_API

let token = (process.env.LS_DOCKER_TOKEN).replaceAll('"', '')

let upload_batch_size = parseInt(process.env.LS_DOCKER_UPLOAD_JSON_BATCH_SIZE)



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// HELPER FUNTIONS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Function generates and returns a list of mhtmls in particular directory
function get_list_from_dir (dir_path) {

    let list = []
    try {
        list = fs.readdirSync(dir_path);
    } catch (err) {
        console.error(err)
    }
    return list

}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// DRIVER CODE
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Adding "http://" to beginning of url to avoid errors with axios
let url_ = "http://" + host + ":" + port + path

console.log(url_)

// Get list of json files in ls_data/json dir
let j_file_list = get_list_from_dir(base_path_lsdata + "json")

let j_list_master = []
let j_list = []

let inc = 0

// Iterate through each file and store and store json object in master list
for (const elem of j_file_list) {

    if (inc % upload_batch_size == 0 && inc > 0) {
        j_list_master.push(j_list)
        j_list = []
    }

    let data = fs.readFileSync(base_path_lsdata + "json/" + elem)
    let j_data = JSON.parse(data)
    j_list.push(j_data)

    inc ++

}

j_list_master.push(j_list)

// console.log(j_list_master)

console.log("Transfering all json files to Label Studio server...")

// Function to post this data to Label Studio
async function postData (j_list) {

    try {
      const resp = await axios({
        method: "post",
        url: url_,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
        },
        data: j_list,
        responseType: 'json'
      })
      console.log(resp.data)
    } catch (err) {
      console.error(err);
    }

};

// Posting json data as tasks in Label Studio. Using async main driver wrapper to serialize posts
async function mainDriver () {
  for (const item of j_list_master) {
      await postData(item)
  }
}

mainDriver ()


