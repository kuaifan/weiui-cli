const dircompare = require('dir-compare');
const fs = require('fs');
const fsEx = require('fs-extra');
const format = require('util').format;

function dateYmdHis()
{
    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    let day = now.getDate();
    let hh = now.getHours();
    let mm = now.getMinutes();
    let ss = now.getSeconds();
    let clock = year + "";
    if(month < 10) clock += "0";
    clock += month;
    if(day < 10) clock += "0";
    clock += day;
    if(hh < 10) clock += "0";
    clock += hh;
    if (mm < 10) clock += '0';
    clock += mm;
    if (ss < 10) clock += '0';
    clock += ss;
    return(clock);
}

let options = {compareSize: true};

let path1 = './a15';
let path2 = './a16';
let path3 = './aaa';

let response = dircompare.compareSync(path1, path2, options);
let ymdhis = dateYmdHis();
response.diffSet.forEach(function (entry) {
    let newpath, repath, bakpath;
    switch (entry.state) {
        case 'left':        //删除
            repath = format('%s%s/%s', path3, entry.relativePath, entry.name1);
            bakpath = format('%s/backup/%s%s/%s', path3, ymdhis, entry.relativePath, entry.name1);
            fs.stat(repath, (err, stats) => {
                if (typeof stats === 'object') {
                    if (stats.isFile()) {
                        fsEx.copy(repath, bakpath);
                        fsEx.remove(repath);
                    }
                }
            });
            break;

        case 'right':       //新增
        case 'distinct':    //修改
            newpath = format('%s/%s', entry.path2, entry.name2);
            repath = format('%s%s/%s', path3, entry.relativePath, entry.name2);
            bakpath = format('%s/backup/%s%s/%s', path3, ymdhis, entry.relativePath, entry.name2);
            fs.stat(newpath, (err, stats) => {
                if (typeof stats === 'object') {
                    if (stats.isFile()) {
                        fsEx.copy(repath, bakpath);
                        fsEx.copy(newpath, repath);
                    }
                }
            });
            break;
    }
});
