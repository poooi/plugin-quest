var http = require('http')
var fs = require('fs')

var file = fs.createWriteStream('assets/info/index.json')
http.get("http://kcwikizh.github.io/kcdata/quest/poi.json", (response) => {
    response.pipe(file)
})
