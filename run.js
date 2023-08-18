//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// SCRIPT DESCRIPTION
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
This script is for convience and runs all the subscripts in order to save time in having to run each individually. 
*/ 



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// REQUIRED MODULES
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const execSync = require('child_process').execSync;



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// DEFINING PATHS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Paths can be found from the default.yaml in the config dir

// const proj_paths = config.get('proj_paths')
// let gt_upload = proj_paths.gt_upload

//// Using environment variable in docker version for greater convience in simultaneous upload situations

// Converting to boolean value

let gt_upload_str = process.env.LS_DOCKER_GT_UPLOAD
let gt_upload = false
if (gt_upload_str == "true") {
    gt_upload = true
}
if (gt_upload_str == "false") {
    gt_upload = false
}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// HELPER FUNTIONS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Function to excute command line commands from inside js script
// Function to excute command line commands from inside js script
function run_cmd (cmd) {

    result = execSync(cmd)
    console.log(result.toString('utf8'))

}

// Sleep function implemetation
function sleep(s) {
    var start = new Date().getTime()
    var expire = start + s;
    while (new Date().getTime() < expire) { }
    return;
}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// DRIVING CODE
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// All scripts to be run
let cmd0 = "node ./clean.js"
let cmd1 = "node ./gt_upload.js"
let cmd2 = "node ./ss_elems_prelab.js"
let cmd3 = "node ./ls_js_conv.js"
let cmd4 = "node ./transfer_ss.js"
let cmd5 = "node ./transfer_json_http.js"



console.log("")
console.log("MASTER TRANSFER SCRIPT STARTED")
console.log("**********************************")
console.log("")

// Running all scripts sequentially
run_cmd(cmd0)
if (gt_upload) {
    run_cmd(cmd1)
}
run_cmd(cmd2)
run_cmd(cmd3)
run_cmd(cmd4)
run_cmd(cmd5)
