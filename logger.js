const chalk = require('chalk');

const infoLabel = chalk.inverse.green("INFO");
const weiuiLabel = chalk.inverse.green("weiui");
const successLabel = chalk.inverse("SUCCESS");
const warningLabel = chalk.inverse("WARN");
const errorLabel = chalk.inverse("ERROR");


exports.log = function(msg) {
    console.log(`[${infoLabel}] ${msg}`);
};

exports.weiui = function(msg) {
    console.log(`[${weiuiLabel}] ${msg}`);
};

exports.success = function(msg) {
    console.log(chalk.green(`[${successLabel}] ${msg}`));
};

exports.warn = function(msg) {
    console.log(chalk.yellow(`[${warningLabel}] ${msg}`));
};

exports.error = function(msg) {
    console.log(chalk.red(`[${errorLabel}] ${msg}`));
    process.exit(1);
};

exports.sep = function() {
    console.log();
};
