const chalk = require('chalk');

const infoLabel = chalk.inverse.green("INFO");
const weiuiLabel = chalk.inverse.green("WEIUI");
const weiuisLabel = chalk.inverse("WEIUI");
const successLabel = chalk.inverse("SUCCESS");
const warningLabel = chalk.inverse("WARN");
const errorLabel = chalk.inverse("ERROR");
const format = require('util').format;


exports.log = function(msg) {
    console.log(`[${infoLabel}] ${msg}`);
};

exports.info = function(msg) {
    console.log(`[${weiuiLabel}] ${msg}`);
};

exports.weiui = function(msg) {
    console.log(`[${weiuiLabel}] ${msg}`);
};

exports.weiuis = function(msg) {
    console.log(chalk.green(`[${weiuisLabel}] ${msg}`));
};

exports.success = function(msg) {
    console.log(chalk.green(`[${successLabel}] ${msg}`));
};

exports.warn = function(msg) {
    console.log(chalk.yellow(`[${warningLabel}] ${msg}`));
};

exports.error = function(msg) {
    console.log(chalk.red(`[${errorLabel}] ${msg}`));
    console.log();
    process.exit(1);
};

exports.fatalContinue = function(...args) {
    if (args[0] instanceof Error) args[0] = args[0].message.trim();
    const msg = format.apply(format, args);
    console.log('[' + chalk.blue(weiuiLabel) + ']', chalk.red(msg));
};

exports.fatal = function(...args) {
    if (args[0] instanceof Error) args[0] = args[0].message.trim();
    const msg = format.apply(format, args);
    console.log('[' + chalk.blue(weiuiLabel) + ']', chalk.red(msg));
    console.log();
    process.exit(1)
};

exports.sep = function() {
    console.log();
};
