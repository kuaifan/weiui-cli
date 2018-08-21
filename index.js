const TemplateRelease = require('./template-release');

module.exports = {
    TemplateRelease,
    constants: {
        templateReleaseUrl: "https://api.github.com/repos/kuaifan/weiui-template/releases",
        cacheDirName: 'weiui'
    }
};
