//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// SCRIPT DESCRIPTION
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
This script transfers the screenshots (ss) to the server via a secure copy command so that they may be accessed by Label Studio. 
All files in the ls_data/ss directory will be uploaded. It will upload in batches. The batch size can be adjusted in the 
config/default.yaml file by changing the "upload_ss_batch_size" parameter. By default is set to 10 because that seems to 
be fairly optimal.
*/ 



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// REQUIRED MODULES
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const fs = require('fs')
const execSync = require('child_process').execSync;
const os = require('os');
const { exit } = require('process');



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// DEFINING PATHS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Paths can be found from the default.yaml in the config dir

// const server_info = config.get('server_info')
// const proj_paths = config.get('proj_paths')
// const upload_params = config.get('upload_parameters') 

// let base_path_lsdata = proj_paths.ls_data_rel
// let server_ls_ss_path = proj_paths.server_ls_ss_path

// let usr = server_info.usr
// let host = server_info.host
// let pass = server_info.pass
// let key_path = server_info.key_path
// let cont_port = server_info.cont_port

// let upload_batch_size = upload_params.upload_ss_batch_size

//// Using environment variable in docker version for greater convience in simultaneous upload situations

let base_path_lsdata = process.env.LS_DOCKER_LS_DATA_REL
let server_ls_ss_path = process.env.LS_DOCKER_SERVER_LS_SS_PATH

let usr = process.env.LS_DOCKER_USR
let host = process.env.LS_DOCKER_HOST
let pass = process.env.LS_DOCKER_PASS
let key_path = process.env.LS_DOCKER_KEY_PATH
let cont_port = process.env.LS_DOCKER_SSH_PORT

let upload_batch_size = parseInt(process.env.LS_DOCKER_UPLOAD_SS_BATCH_SIZE)



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

// Sleep function implemetation
function sleep(s) {
    var start = new Date().getTime()
    var expire = start + s;
    while (new Date().getTime() < expire) { }
    return;
}

// Function to excute command line commands from inside js script
function run_cmd (cmd) {

    result = execSync(cmd)
    console.log(result.toString('utf8'))

}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// DRIVING CODE
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  
// Getting a list of all screenshot.png to be transfered from ls_data/ss
ss_list = get_list_from_dir(base_path_lsdata + "ss")

ss_list_path = []

// Creating list of each screenshot's full path
ss_list.forEach(elem => {
    ss_list_path.push(base_path_lsdata + "ss/" + elem)
});

// Checking operating system of current machine
const ost = os.type()

//// Checking OS and installing sshpass library for Linux and Mac OS
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

sleep(1000)

let tmp_str_list = []
let tmp_str = ""

let inc = 0

console.log('Transfering all screenshots to Label Studio server...')

// Concatenating all screenshot's full paths
ss_list_path.forEach(elem => {

    if (inc % upload_batch_size == 0 && inc > 0) {
        tmp_str_list.push(tmp_str)
        tmp_str = ""
    }

    tmp_str = tmp_str + elem + " "

    inc ++

});

tmp_str_list.push(tmp_str)

for (const group of tmp_str_list) {

    // Generating correct scp command
    cmd = getCMD(ost, group)

    console.log(cmd)

    // Transfering all screenshot to Label Studio server
    run_cmd(cmd)

    // Sleep(100)

}





