const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('/Users/dhashdhasher/Documents/Apps/AntiG/efe/fg 1.pdf');

console.log(pdf);
// pdf(dataBuffer).then(function(data) {
//     console.log(data.text);
// });
