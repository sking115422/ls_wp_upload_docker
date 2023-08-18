//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// SCRIPT DESCRIPTION
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
This script transfers the GT json and raw webpage images files to the server. It is a combination of the transfer_json_http
and tranfer_ss scripts. It works with LS formatted json and webpage screenshots as PNG.
*/ 



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// REQUIRED MODULES
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const fs = require('fs')
const axios = require('axios');
const os = require('os');
const { exit } = require('process');
const execSync = require('child_process').execSync;



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// DEFINING PATHS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Paths can be found from the default.yaml in the config dir

// const server_info = config.get('server_info')
// const label_studio_info = config.get('label_studio_info')
// const proj_paths = config.get('proj_paths')
// const upload_params = config.get('upload_parameters') 

// let base_gt_path = proj_paths.gt_dir
// let server_ls_ss_path = proj_paths.server_ls_ss_path

// let usr = server_info.usr
// let host = server_info.host
// let port = server_info.port
// let path = proj_paths.server_ls_import_api
// let pass = server_info.pass
// let key_path = server_info.key_path
// let cont_port = server_info.cont_port

// let token = label_studio_info.token

// let upload_batch_size = upload_params.upload_json_batch_size

//// Using environment variable in docker version for greater convience in simultaneous upload situations

let base_gt_path = process.env.LS_DOCKER_GT_DIR
let server_ls_ss_path = process.env.LS_DOCKER_SERVER_LS_SS_PATH

let usr = process.env.LS_DOCKER_USR
let host = process.env.LS_DOCKER_HOST
let port = process.env.LS_DOCKER_HOST_PORT
let path = process.env.LS_DOCKER_SERVER_LS_IMPORT_API
let pass = process.env.LS_DOCKER_PASS
let key_path = process.env.LS_DOCKER_KEY_PATH
let cont_port = process.env.LS_DOCKER_SSH_PORT

let token = (process.env.LS_DOCKER_TOKEN).replaceAll('"', '')

let upload_batch_size = process.env.LS_DOCKER_UPLOAD_JSON_BATCH_SIZE



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

// This function selects the correct secure copy command based on the current machines OS
function getCMD(ost, elem) {

  if (ost == "Windows_NT") {
      if (pass != "none") {
          cmd = "pscp -pw " + pass + " -P " + cont_port + " " + elem + " " + usr + "@" + host + ":" + server_ls_ss_path 
          return cmd
      }
      else {
          cmd = "scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i " + key_path + " -P " + cont_port + " " + elem + " " + usr + "@" + host + ":" + server_ls_ss_path 
          return cmd
      }
  }
  if (ost == "Darwin") {
      if (pass != "none") {
          cmd = "sshpass -p " + '"' + pass + '"' + " scp -o StrictHostKeyChecking=no -P " + cont_port + " " + elem + " " + usr + "@" + host + ":" + server_ls_ss_path 
          return cmd
      }
      else {
          cmd = "scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i " + key_path + " -P " + cont_port + " " + elem + " " + usr + "@" + host + ":" + server_ls_ss_path 
          return cmd
      }
  }
  if (ost == "Linux") {
      if (pass != "none") {
          cmd = "sshpass -p " + '"' + pass + '"' + " scp -o StrictHostKeyChecking=no -P " + cont_port + " " + elem + " " + usr + "@" + host + ":" + server_ls_ss_path     // + "ss" 
          return cmd
      }
      else {
          cmd = "scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i " + key_path + " -P " + cont_port + " " + elem + " " + usr + "@" + host + ":" + server_ls_ss_path 
          return cmd
      }
  }
}

// Function to excute command line commands from inside js script
function run_cmd (cmd) {

	result = execSync(cmd)
	console.log(result.toString('utf8'))

}

function upload_ss (ost, list) {

	str = list.join(" ")
	cmd = getCMD(ost, str)
	console.log(cmd)
	run_cmd(cmd)

}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// DRIVER CODE
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

////// For screenshot upload

// Checking operating system of current machine
const ost = os.type()

// Creating list to hold paths to each screenshot
ss_upload_list = []

// Checking OS and installing sshpass library for Linux and Mac OS
if (ost == "Windows_NT") {
  console.log("Windows OS")
}
else if (ost == "Darwin") {
  // May have to be updated from time to time
  // Other repos for sshpass for Mac can be found at the link below
  // https://github.com/search?o=desc&q=homebrew+sshpass&s=updated&type=Repositories
  console.log("Mac OS")
  run_cmd("brew install capicuadev/sshpass/sshpass") 
}
else if (ost == "Linux") {
  console.log("Linux OS")
  run_cmd("sudo apt-get install sshpass")
}
else {
  console.log("This operating system is not recognized and is not support by this code!")
  exit(1)
}

////// For JSON upload

// Adding "http://" to beginning of url to avoid errors with axios
let url_ = "http://" + host + ":" + port + path

// Get list of json files in ls_data/json dir
let j_file = fs.readFileSync(base_gt_path + "gt.json")
let j_list = JSON.parse(j_file)

// Creating list to hold each json object as string
j_upload_list = []

inc = 0

console.log("Transfering all ground truth data to Label Studio server...")

async function mainDriver () {

	for (const obj of j_list) {

		wp_name = obj["data"]["image"].split("/").slice(-1)[0]
		wp_path = base_gt_path + "gt_imgs/" + wp_name

		// Uploading when inc reaches upload batch size threshold (uses JSON for both in this case) then resetting lists
		if (inc % upload_batch_size == 0 && inc > 0) {
			
			upload_ss(ost, ss_upload_list)
			ss_upload_list = []

			await postData(j_upload_list)
			j_upload_list = []

		}

		ss_upload_list.push(wp_path)
		j_upload_list.push(obj)

		inc ++
		
	}

	// Uploading any remainder that does not evenly fit into upload batch
	upload_ss(ost, ss_upload_list)
	postData(j_upload_list)

}

mainDriver ()