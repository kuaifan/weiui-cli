const fse = require("fs-extra");
const utils = require("./index");


const projectUtils = {

    /**
     * 初始化项目设置
     * @param dir
     * @param config
     */
    initConfig(dir, config) {
        this.changeFile(dir + '/platforms/android/WeexWeiui/build.gradle', 'cc.weiui.playground', config.applicationID);
        this.changeFile(dir + '/platforms/android/WeexWeiui/app/src/main/res/values/strings.xml', 'WeexWeiui', config.appName);
        this.changeFile(dir + '/platforms/ios/WeexWeiui/WeexWeiui.xcodeproj/project.pbxproj', 'PRODUCT_BUNDLE_IDENTIFIER = cc.weiui.playground;', 'PRODUCT_BUNDLE_IDENTIFIER = ' + config.bundleIdentifier + ';');
        this.changeFile(dir + '/platforms/ios/WeexWeiui/WeexWeiui/Info.plist', 'WeexWeiui', config.appName);
        utils.replaceDictString(dir + '/platforms/ios/WeexWeiui/WeexWeiui/Info.plist', 'weiuiAppName', 'weiuiApp' + this.replaceUpperCase(config.bundleIdentifier));
        fse.writeFileSync(dir + "/.weiui.release", JSON.stringify(config, null, "\t"), 'utf8');
    },

    /**
     * 替换字符串
     * @param  {string} path 文件路径.
     * @param  {string} oldText
     * @param  {string} newText
     */
    changeFile(path, oldText, newText) {
        if (!fse.existsSync(path)) {
            return;
        }
        let result = fse.readFileSync(path, 'utf8').replace(new RegExp(oldText, "g"), newText);
        if (result) {
            fse.writeFileSync(path, result, 'utf8');
        }
    },

    /**
     * 将点及后面的第一个字母换成大写字母，如：aaa.bbb.ccc换成AaaBbbCcc
     * @param string
     * @returns {*}
     */
    replaceUpperCase(string) {
        try {
            return string.replace(/^[a-z]/g, function ($1) {
                return $1.toLocaleUpperCase()
            }).replace(/\.+(\w)/g, function ($1) {
                return $1.toLocaleUpperCase()
            }).replace(/\./g, '');
        } catch (e) {
            return string;
        }
    }
};

module.exports = projectUtils;
