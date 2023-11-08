//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// SCRIPT DESCRIPTION
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
This script takes in either a path to a directory of MHTML or a path to a file of urls (as line items. there should be no empty
lines or the code will throw an error). From this input it will collect a screenshot of the webpage generated, grab all the DOM 
elements associated with the webpage, and attempt to naively prelabel the elements based on some simple heuristics. Once it is 
finished a png and json file will be output to a sub folder label as "run_#" in the site_data directory. 
*/ 



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// REQUIRED MODULES
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const puppeteer = require('puppeteer')
const fs = require('fs');

// https://stackoverflow.com/questions/9768444/possible-eventemitter-memory-leak-detected
// Can disable MaxListernsExceededWarning by uncommenting below
// require('events').EventEmitter.prototype._maxListeners = 100;
// process.setMaxListeners(0);



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// DEFINING PATHS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Paths can be found from the default.yaml in the config dir

// const proj_paths = config.get('proj_paths')

// let outPath = proj_paths.site_data_rel
// let source_type = proj_paths.source_type
// let path_to_mhtmls = proj_paths.mhtml_dir
// let path_to_url = proj_paths.url_path
// // let gt_upload = proj_paths.gt_upload
// let new_ss_img = proj_paths.new_ss_img
// // let path_to_gt = proj_paths.gt_dir

// const pupp_conf = config.get('puppeteer_config')

// let vh = pupp_conf.view_height
// let vw = pupp_conf.view_width
// let to = pupp_conf.time_out_sec
// let wait_until = pupp_conf.wait_until
// let headless_ = pupp_conf.headless
// let delay = pupp_conf.delay_ms

// const upload_params = config.get("upload_parameters")

// let max_upload_num = upload_params.max_upload_num

//// Using environment variable in docker version for greater convience in simultaneous upload situations

let outPath = process.env.LS_DOCKER_SITE_DATA_REL
let source_type = process.env.LS_DOCKER_SOURCE_TYPE
let path_to_mhtmls = process.env.LS_DOCKER_MHTML_DIR
let path_to_url = process.env.LS_DOCKER_URL_PATH

let new_ss_img_str = process.env.LS_DOCKER_NEW_SS_IMG
let new_ss_img = true
if (new_ss_img_str == "true") {
    new_ss_img = true
}
if (new_ss_img_str == "false") {
    new_ss_img = false
}

let vh = parseInt(process.env.LS_DOCKER_VIEW_HEIGHT)
let vw = parseInt(process.env.LS_DOCKER_VIEW_WIDTH)
let to = parseInt(process.env.LS_DOCKER_TIME_OUT_SEC)
let wait_until = process.env.LS_DOCKER_WAIT_UNTIL

let headless_str = process.env.LS_DOCKER_HEADLESS
let headless_ = true
if (headless_str == "true") {
    headless_ = true
}
if (headless_str == "false") {
    headless_ = false
}

let delay = parseInt(process.env.LS_DOCKER_DELAY_MS)

let max_upload_num = parseInt(process.env.LS_DOCKER_MAX_UPLOAD_NUM)



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// HELPER FUNTIONS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Function to create a directory to specified path
function createDir (dir) {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
}

// Sleep function implemetation
function sleep(ms) {
    var start = new Date().getTime()
    var expire = start + ms;
    while (new Date().getTime() < expire) { }
    return;
}

// Function generates a list of urls specified in a text file for processing
function getUrlsFromTextFile (path) {

    const urls = []

    try {
        const tmp = fs.readFileSync(path, 'utf8')
        tmp.split(/\r?\n/).forEach(line => {
            urls.push(line)
        })
    } catch (err) {
        console.error(err)
    }

    return urls
}

// Function generates and returns a list of names in particular directory
function get_names_from_dir (dir_path) {

    let name_list = []

    try {

        name_list = fs.readdirSync(dir_path);

    } catch (err) {
        console.error(err)
    }

    return name_list

}

// Function uses puppeteer to grab a screenshot and page elements as a json file of a given url or mhtml 
async function get_ss_elements (uri, st, full_path_out, index_num) {

    // Grabbing screenshot
    
    const browser = await puppeteer.launch({
        // executablePath: '/usr/bin/chromium-browser',
        headless:headless_,
        args: ["--no-sandbox"]
      })
    // const browser = await puppeteer.launch({headless:headless_})
    const page = await browser.newPage()
    await (await browser.pages())[0].close(); //close first one, to overcome the bug in stealth library mentioned in
    //https://github.com/berstend/puppeteer-extra/issues/88
    
    uniq_uri_id = ""        

    try {

        if (st == "url" ) {
            uniq_uri_id = uri.split(".")[1]
        } else if (st = "mhtml" ){
            uniq_uri_id = uri.split(".")[0].split("/").slice(-1)
        } else {
            console.log("Strange error has occured... check input source type!")
            return
        }

        await page.setViewport({
            height: vh,
            width: vw
        });


        await page.goto(uri, {
            //https://blog.cloudlayer.io/puppeteer-waituntil-options/
            waitUntil: wait_until,
            timeout: to * 1000
            // timeout: 0
        })

        await sleep(delay)

        await page.screenshot({
            path: `${full_path_out}/${uniq_uri_id}_ss_${index_num}.png`,
            clip: {
                x:0,
                y:0,
                width: vw,
                height: vh
            }
        })

    } catch (e) {

        console.error(e)
        await page.close()
        await browser.close()

    }

    let j_list = []

    try {

        // Executing javascript on the webpage with .evaluate 
        j_list = await page.evaluate((vh, vw) => {

            // Function to check that the element actually has some measurable size
            function checkRect(rect) {
                if (rect.width != 0 && rect.height != 0 && !(rect.x < 0 || rect.y < 0) )
                    return true
                else 
                    return false
            }

            // Function to make sure that no elements are out of the view height or width
            function checkElemsAreInSS(rect) {
                // console.log(vh)
                // console.log(vw)
                if ((rect.width + rect.x) > vw || (rect.height + rect.y) > vh || rect.x > vw || rect.y > vh)
                    return false
                else 
                    return true
            }

            function checkVis (visibility) {
                if (visibility == "hidden" || visibility == "collapse")
                    return false
                else 
                    return true
            }

            function checkDisp (display) {
                if (display == "none") 
                    return false
                else 
                    return true
            }

            // Getting all webpage elements
            const allElements = document.querySelectorAll('*');
            const tmp_list_1 = []

            index = 0
            
            // Iterating through all elements
            for (const element of allElements) {
                
                // Gathering important element attributes
                var num_children_ = element.childNodes.length
                var rect = element.getBoundingClientRect()
                var tag_ = element.tagName != undefined ? element.tagName : 'null'
                var innerText_ = element.textContent
                var id_ = element.id != '' ? element.id : 'null'
                var name_ = element.name != null ? element.name : 'null'
                var type_ = element.type != null ? element.type : 'null'
                var text_ = element.Text != null ? element.Text : 'null'
                var value_ = element.value != null ? element.value : 'null'
                var visibility_ = element.style.visibility != undefined ? element.style.visibility : 'null'
                var display_ = element.style.display != undefined ? element.style.display : "null"
                var placeholder_ = element.placeholder != null ? element.placeholder!= '' ? element.placeholder:  'null' : 'null'
                var src_ = element.src != null ? element.src : 'null'
                var alt_ = element.alt != null ? element.alt : 'null'
                var class_ = element.className != null ? element.className : 'null'
                var elm_label = element.label != null ? element.label : 'null'

                console.log(display_)

                // Setting default label of na for not applicable
                var label_ = "na"

                // Getting all attribute names for each element
                var attNames = element.getAttributeNames()

                if (checkRect(rect) && checkElemsAreInSS(rect) && checkVis(visibility_) && checkDisp(display_)){

                    // Iterating through each attribute for each element
                    for (const item of attNames) {
                        
                        // If attribute is a string check to see if it match heuristics below
                        // If it does it will be assigned it a logical label
                        if (typeof(item) === "string"){

                            var att = element.getAttribute(item)

                            // MEDIA

                            // if (att.toLowerCase().includes("video") && ((tag_ == "DIV")))
                            //     label_ = "Video"

                            // if ((tag_ == "IMG"))
                            //     label_ = "Image"

                            // BUTTONS

                            if (att.toLowerCase().includes("button") && 
                                ((tag_ == "DIV" || tag_ == "BUTTON")))
                                    label_ = "General Button"

                            if (att.toLowerCase().includes("login")  ||
                                att.toLowerCase().includes("log in")  ||
                                att.toLowerCase().includes("sign in") &&
                                ((tag_ == "DIV" || tag_ == "BUTTON"))) 
                                    label_ = "Login Button"
                            
                            if (att.toLowerCase().includes("submit")  ||
                                att.toLowerCase().includes("agree")  ||
                                att.toLowerCase().includes("next") &&
                                ((tag_ == "DIV" || tag_ == "BUTTON"))) 
                                    label_ = "Submit Button"

                            if (att.toLowerCase().includes("download") ||
                                att.toLowerCase().includes("install") && 
                                ((tag_ == "DIV" || tag_ == "BUTTON")))
                                    label_ = "Download Button"

                            if (att.toLowerCase().includes("search") || 
                                att.toLowerCase().includes("go") &&
                                ((tag_ == "DIV" || tag_ == "BUTTON")))
                                    label_ = "Search Button"                         

                            if (att.toLowerCase().includes("update") || 
                                att.toLowerCase().includes("renew") ||
                                att.toLowerCase().includes("reinstall") &&
                                ((tag_ == "DIV" || tag_ == "BUTTON")))
                                    label_ = "Update Button"

                            if (att.toLowerCase().includes("close") || 
                                att.toLowerCase().includes("exit") ||
                                att.toLowerCase().includes("cancel") && 
                                ((tag_ == "DIV" || tag_ == "BUTTON")))
                                    label_ = "Close Button"

                            if (att.toLowerCase().includes("play") || 
                                att.toLowerCase().includes("start") && 
                                ((tag_ == "DIV" || tag_ == "BUTTON")))
                                    label_ = "Play Button"

                            // INPUT BOX

                            if ((tag_ == "INPUT"))
                                label_ = "General Input Box"    

                            if (type_.toLowerCase().includes("checkbox") &&
                                (tag_ == "INPUT"))
                                label_ = "Checkbox"

                            if (att.toLowerCase().includes("name") && 
                                ((tag_ == "INPUT")))
                                    label_ = "Name Input Box"

                            if (att.toLowerCase().includes("search") || 
                                att.toLowerCase().includes("go") &&
                                ((tag_ == "INPUT")))
                                    label_ = "Search Input Box"

                            if (att.toLowerCase().includes("phone") || 
                                att.toLowerCase().includes("phone number") || 
                                att.toLowerCase().includes("mobile") ||
                                att.toLowerCase().includes("cell") &&
                                ((tag_ == "INPUT")))
                                    label_ = "Phone Input Box"

                            if (att.toLowerCase().includes("email") || 
                                att.toLowerCase().includes("e-mail") &&
                                ((tag_ == "INPUT")))
                                        label_ = "Email Input Box"

                            if (att.toLowerCase().includes("password") &&
                                ((tag_ == "INPUT")))
                                    label_ = "Password Input Box"

                            if (att.toLowerCase().includes("address") ||
                                att.toLowerCase().includes("street") ||
                                att.toLowerCase().includes("unit") ||
                                att.toLowerCase().includes("apt") ||
                                att.toLowerCase().includes("zip") ||
                                att.toLowerCase().includes("post") ||
                                att.toLowerCase().includes("code") ||
                                att.toLowerCase().includes("city") ||
                                att.toLowerCase().includes("state") ||
                                att.toLowerCase().includes("country") &&
                                ((tag_ == "INPUT")))
                                    label_ = "Address Input Box"

                            // CAPTCHA

                            if (att.toLowerCase().includes("captcha") && ((tag_ == "DIV" || tag_ == "IFRAME")))
                                label_ = "Click Captcha"

                            // MEDIA

                            if (att.toLowerCase().includes("logo") && ((tag_ == "IMG")))
                                label_ = "Logo"

                            if (tag_ == "VIDEO")
                                label_ = "Video"

                        }
                
                    }
                                    
                }

                // If label is not na we will add element to list of relevant elements
                if (label_ != "na") {

                    tmp_list_1.push({
                        
                        uniq_id: index,         // Unique element index
                        label: label_,          // Label corresponding to element
                        tag: tag_,              // HTML tag
                        coords: rect.toJSON()   // Coordinates positions of element on webpage

                    })
                    
                    // Increment unique element id
                    index++ 

                }

            }

            function get_y_range(rect) {

                y_start = rect.y
                y_end = rect.y + rect.height
    
                return [y_start, y_end]
            }
    
            function get_x_range(rect) {
    
                x_start = rect.x
                x_end = rect.x + rect.width
    
                return [x_start, x_end]
            }
    
            const tmp_list_2 = []
    
            ///////////////////////////////////////////////////////////////
    
            for (let i = 0; i < tmp_list_1.length; i++ ) {
    
                add_to_list = true
    
                var coord_1 = tmp_list_1[i].coords
                var child_1 = tmp_list_1[i].num_children
    
                var x_r_1 = get_x_range(coord_1)
                var y_r_1 = get_y_range(coord_1)
    
                for (let j = 0; j < tmp_list_1.length; j++ ) {
    
                        var coord_2 = tmp_list_1[j].coords
                        var child_2 = tmp_list_1[i].num_children
    
                        var x_r_2 = get_x_range(coord_2)
                        var y_r_2 = get_y_range(coord_2)
    
                        let inside = false
                        let equal_to = false
                        let mismatch = false
    
                    
                    if (i != j) {
    
                        //// NESTED ELEMENT
    
                        // if one element 1 has any element fully inside it
                        if  (x_r_1[0] < x_r_2[0] && x_r_2[1] < x_r_1[1] && y_r_1[0] < y_r_2[0] && y_r_2[1] < y_r_1[1])
                            inside = true
    
                        //// ELEMENT EQUALITY
    
                        // if element 1 has an element 2 inside and 1 side equal 
                        if  ((x_r_1[0] == x_r_2[0] && x_r_2[1] < x_r_1[1] && y_r_1[0] < y_r_2[0] && y_r_2[1] < y_r_1[1]))
                            equal_to = true
                        if  ((x_r_1[0] < x_r_2[0] && x_r_2[1] == x_r_1[1] && y_r_1[0] < y_r_2[0] && y_r_2[1] < y_r_1[1]))
                            equal_to = true
                        if  ((x_r_1[0] < x_r_2[0] && x_r_2[1] < x_r_1[1] && y_r_1[0] == y_r_2[0] && y_r_2[1] < y_r_1[1]))
                            equal_to = true
                        if  ((x_r_1[0] < x_r_2[0] && x_r_2[1] < x_r_1[1] && y_r_1[0] < y_r_2[0] && y_r_2[1] == y_r_1[1]))
                            equal_to = true
    
                        // if element 1 has an element inside and 2 sides equal
                        if  ((x_r_1[0] == x_r_2[0] && x_r_2[1] == x_r_1[1] && y_r_1[0] < y_r_2[0] && y_r_2[1] < y_r_1[1]))
                            equal_to = true
                        if  ((x_r_1[0] == x_r_2[0] && x_r_2[1] < x_r_1[1] && y_r_1[0] == y_r_2[0] && y_r_2[1] < y_r_1[1]))
                            equal_to = true
                        if  ((x_r_1[0] == x_r_2[0] && x_r_2[1] < x_r_1[1] && y_r_1[0] < y_r_2[0] && y_r_2[1] == y_r_1[1]))
                            equal_to = true
                        if  ((x_r_1[0] < x_r_2[0] && x_r_2[1] == x_r_1[1] && y_r_1[0] == y_r_2[0] && y_r_2[1] < y_r_1[1]))
                            equal_to = true
                        if  ((x_r_1[0] < x_r_2[0] && x_r_2[1] == x_r_1[1] && y_r_1[0] < y_r_2[0] && y_r_2[1] == y_r_1[1]))
                            equal_to = true
                        if  ((x_r_1[0] < x_r_2[0] && x_r_2[1] < x_r_1[1] && y_r_1[0] == y_r_2[0] && y_r_2[1] == y_r_1[1]))
                            equal_to = true
    
                        // if element 1 has an element inside and 3 sides equal
                        if  ((x_r_1[0] == x_r_2[0] && x_r_2[1] == x_r_1[1] && y_r_1[0] == y_r_2[0] && y_r_2[1] < y_r_1[1]))
                            equal_to = true
                        if  ((x_r_1[0] == x_r_2[0] && x_r_2[1] < x_r_1[1] && y_r_1[0] == y_r_2[0] && y_r_2[1] == y_r_1[1]))
                            equal_to = true
                        if  ((x_r_1[0] < x_r_2[0] && x_r_2[1] == x_r_1[1] && y_r_1[0] == y_r_2[0] && y_r_2[1] == y_r_1[1]))
                            equal_to = true
                        if  ((x_r_1[0] == x_r_2[0] && x_r_2[1] < x_r_1[1] && y_r_1[0] == y_r_2[0] && y_r_2[1] == y_r_1[1]))
                            equal_to = true
    
                        // if element 1 has any element 2 exactly equal to it
                        if  ((x_r_1[0] == x_r_2[0] && x_r_2[1] == x_r_1[1] && y_r_1[0] == y_r_2[0] && y_r_2[1] == y_r_1[1]) && child_1 != 0)
                            equal_to = true
                        
                        //// ELEMENT NESTING SIZE MISMATCH
                        
                        // if  ((x_r_1[0] == x_r_2[0] && x_r_2[1] == x_r_1[1] && y_r_1[0] < y_r_2[0] && y_r_2[1] > y_r_1[1]) && child_1 != 0)
                        //     mismatch = true
    
    
    
    
                        // if (x_r_1[0] <= x_r_2[0] && x_r_2[1] <= x_r_1[1] && y_r_1[0] <= y_r_2[0] && y_r_2[1] <= y_r_1[1] )
    
                        // if (Math.abs(x_r_1[0] - x_r_2[0]) < ratio * x_r_1[0] && Math.abs(x_r_2[1] - x_r_1[1]) < ratio * x_r_1[1] &&
                        // Math.abs(y_r_1[0] - y_r_2[0]) < ratio * y_r_1[0] && Math.abs(y_r_2[1] - y_r_1[1]) < ratio * y_r_1[1])
    
                        // ratio = .01
    
                        if ( inside || equal_to || mismatch) {
                            add_to_list = false
                        }
    
                    }
    
                }
    
                if (add_to_list) {
    
                    tmp_list_2.push(tmp_list_1[i])
                }
    
            }
    

            // Return list of relevant elements
            return tmp_list_2

        }, vh, vw)

        // Write out json file of relevant elements
        await fs.promises.writeFile(`${full_path_out}/elems_${index_num}.json`, JSON.stringify(j_list), (error) => {
            if (error) throw error
        })

    } catch (e) {

        console.error(e)

    } finally {

        await page.close()
        await browser.close()

    }

}

async function processMhtmls (mhtml_path) {

    let pwd = require('path').resolve(mhtml_path, '.')
    let = mhtml_list = get_names_from_dir(mhtml_path)

    upload_counter = 0

    for (const mhtml of mhtml_list) {

        if (upload_counter == max_upload_num) {
            break
        }

        // let uri = "file://" + pwd + "/" + mhtml // For linux and mac
        let uri = pwd + "/" + mhtml
        uri = uri.replaceAll("\\", "/")
        console.log(uri)
        
        // Creating paths
        index_num ++
        subFolderName = `run_${index_num}`
        full_path_out = `${outPath}${subFolderName}`

        // Creating output director if it does not already exist
        try {
            if (!fs.existsSync(full_path_out)) {
                fs.mkdirSync(full_path_out)
            }
        } catch (err) {
            console.error(err)
        }

        // Getting web page elements. If any errors are encountered, delete the associated directory and move on.
        try {
            await get_ss_elements (uri, 'mhtml', full_path_out, index_num)
            upload_counter ++
        } catch (e) {
            try {
                fs.rmSync(full_path_out, { recursive: true })
            } catch (e) {
                console.error(e)
            }
            console.error(e)
        }
    }

}

async function processUrls (url_path) {

    let url_list = getUrlsFromTextFile(url_path)

    upload_counter = 0

    // Iterate through each element in list
    for (const url of url_list) {

        if (upload_counter == max_upload_num) {
            break
        }

        t_list = url.split(".").slice(-2)

        url_comp = "https://www." + t_list[0] + "." + t_list[1]

        console.log(url_comp)

        // Creating paths
        index_num ++
        subFolderName = `run_${index_num}`
        full_path_out = `${outPath}${subFolderName}`

        // Creating output director if it does not already exist
        try {
            if (!fs.existsSync(full_path_out)) {
                fs.mkdirSync(full_path_out)
            }
        } catch (e) {
            console.error(e)
        }

        // Getting web page elements. If any errors are encountered, delete the associated directory and move on.
        try {
            await get_ss_elements (url_comp, "url", full_path_out, index_num)
            upload_counter ++
        } catch (e){
            try {
                fs.rmSync(full_path_out, { recursive: true })
            } catch (e) {
                console.error(e)
            }
            console.error(e)
        }
    }
}

function cleanSiteData (path) {
    dir_list = fs.readdirSync(path)
    for (const dir of dir_list) {
        var content_list = fs.readdirSync(path + dir)
        var c = 0
        for (const file of content_list){
            if (file.slice(-4) == "json" || file.slice(-3) == "png") {
                c++ 
            }
        }
        if (c != 2) {
            fs.rmdirSync(path + "/" + dir, {recursive: true})
            console.log("removed: " + path + dir)
        }
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// DRIVER FUNTION
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function mainDriver () {

    index_num = 0

    createDir (outPath)

    // if (gt_upload) {
    //     console.log("Processing and uploading ground truth mhtmls...")
    //     await processMhtmls(path_to_gt)        
    // }

    if (new_ss_img) {

        console.log("Processing and uploading new uri...")

        if (source_type == "mhtml") {
            await processMhtmls(path_to_mhtmls)
        }
        else if (source_type == "url") {
            await processUrls(path_to_url)
        }
        else {
            console.log("You have entered an incorrect value for source_type... Please make sure it is either 'url' or 'mhtml'.")
        }        

    }

    cleanSiteData(outPath)


}

// Driver function call
mainDriver()



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// OLD CODE
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


            // // Tags of Possible interest
            // // IMG, P, H1, H2, H3, BUTTON, A, INPUT, STRONG

            // if (tag_ == "IMG" && checkHeight && checkWidth) {
            //     if (src_.toLocaleLowerCase().includes("logo") || alt_.toLocaleLowerCase().includes("logo"))
            //         label_ = "Logo"
            //     else if (src_.toLocaleLowerCase().includes("ad") || class_.toLocaleLowerCase().includes("ad"))
            //         label_ = "Advertisement"
            //     else
            //         label_ = "Image"
            // }
            // if (tag_ == "VIDEO" && checkHeight && checkWidth) {
            //     label_ = "Video"
            // }
            // else if (tag_ == "BUTTON" && checkHeight && checkWidth) {
            //     if (innerText_.toLocaleLowerCase().includes("search") ||
            //         innerText_.toLocaleLowerCase().includes("go")) 

            //         label_ = "Search Button"
            //     else if (innerText_.toLowerCase().includes("submit"))
            //         label_ = "Submit Button"
            //     else if (innerText_.toLowerCase().includes("install"))
            //         label_ = "Install Button"
            //     else if (innerText_.toLowerCase().includes("accept"))
            //         label_ = "Accept Button"
            //     else if (innerText_.toLowerCase().includes("next") ||
            //              innerText_.toLowerCase().includes("continue") ||
            //              innerText_.toLowerCase().includes("proceed"))
            //         label_ = "Next Button"
            //     else if (innerText_.toLowerCase().includes("download") ||
            //              innerText_.toLowerCase().includes("renew"))
            //         label_ = "Download Button"
            //     else
            //         label_ = "General Button"
            // }
            // else if (tag_ == "DIV" && checkHeight && checkWidth) {
            //     if (class_.toLowerCase().includes("button")){
            //         if (innerText_.toLocaleLowerCase().includes("search") ||
            //             innerText_.toLocaleLowerCase().includes("go")) 
            //         label_ = "Search Button"
            //         else if (innerText_.toLowerCase().includes("submit"))
            //             label_ = "Submit Button"
            //         else if (innerText_.toLowerCase().includes("install"))
            //             label_ = "Install Button"
            //         else if (innerText_.toLowerCase().includes("accept"))
            //             label_ = "Accept Button"
            //         else if (innerText_.toLowerCase().includes("next") ||
            //                  innerText_.toLowerCase().includes("continue") ||
            //                  innerText_.toLowerCase().includes("proceed"))
            //             label_ = "Next Button"
            //         else if (innerText_.toLowerCase().includes("download") ||
            //                  innerText_.toLowerCase().includes("renew"))
            //             label_ = "Download Button"
            //         else
            //             label_ = "General Button"
            //     if (class_.toLowerCase().includes("captcha") ||
            //         id_.toLowerCase().includes('captcha') || 
            //         element.hasAttribute('data-sitekey'))

            //         label_ = "Captcha"
            //     }
            // }
            // else if (tag_ == "IFRAME" && checkHeight && checkWidth) {

            // }

            // // else if (tag_ == "A" && checkHeight && checkWidth) {
            // //     label_ = "Text Link"
            // // }
            
            // else if (tag_ == "INPUT" && checkHeight && checkWidth) {
            //     if (type_.toLowerCase().includes("search") ||
            //         elm_label.toLowerCase().includes("search") ||
            //         placeholder_.toLowerCase().includes("search"))

            //         label_ = "Search Bar"
            //     else if (type_.toLowerCase().includes("checkbox"))
            //         label_ = "Check Box"
            //     else 
            //         label_ = "Input Box"
            // }
