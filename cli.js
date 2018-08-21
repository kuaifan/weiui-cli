#!/usr/bin/env node

var yargs = require("yargs");
var path = require("path");
var fs = require("fs-extra");
var chalk = require('chalk');
var logger = require("./logger");

const TemplateRelease = require("./template-release");
const constants = require('./index').constants;

const templateRelease = new TemplateRelease(constants.cacheDirName, constants.templateReleaseUrl);

/**
 * 复制 template 文件以创建 weiui 工程.
 * @param  {string} name project name.
 * @param  {string} [version] template version.
 * @param  {string} [templateName] init src/ dir with specified template
 */
function initProject(name, version, templateName) {
    if (fs.existsSync(name)) {
        logger.error(`File ${name} already exist.`);
    }
    logger.weiui("Creating project...");
    templateRelease.fetchRelease(version, function (err, releasePath) {
        if (err) {
            logger.error(err);
            return;
        }
        logger.weiui("Copying template file...");
        fs.copySync(releasePath, name);
        logger.sep();
        logger.weiui("Project created.");
        logger.sep();
        logger.weiui("Run flowing code to get started.");
        logger.weiui(chalk.white(`1. cd ${name}`));
        logger.weiui(chalk.white(`2. npm install`));
        logger.weiui(chalk.white(`3. npm run serve`));
        const templatesDir = path.join(name, 'templates');
        if (templateName) {
            logger.sep();
            logger.weiui("Initing template...");
            let tPath = path.join(templatesDir, templateName);
            if (!fs.existsSync(tPath)) {
                logger.warn(`Template ${templateName} not exist. Using default template.`);
                return
            }
            let srcPath = path.join(name, "src");
            fs.removeSync(srcPath);
            fs.copySync(tPath, srcPath);
            logger.weiui("Copy template done.");
        }
        fs.removeSync(templatesDir);
    });
}

function displayReleases() {
    logger.log("Fetching version info...");
    templateRelease.fetchReleaseVersions((err, result) => {
        if (err) {
            logger.error(err);
            return;
        }
        console.log("Available versions:");
        result.forEach(t => {
            console.log(chalk.green.underline(t));
        })
    })
}

var args = yargs
    .command({
        command: "create <name> [version]",
        desc: "Create a weiui project. Default to use latest version of template.",
        builder: (yargs) => {
            yargs.option('template', {
                alias: 't',
                describe: 'Init with specified template.'
            })
        },
        handler: function (argv) {
            initProject(argv.name, argv.version, argv.template);
        }
    })
    .command({
        command: "list",
        desc: "List available version of template releases.",
        handler: function () {
            displayReleases();
        }
    })
    .command({
        command: "list-template",
        desc: "List available templates for the newest release.",
        handler: function () {
            templateRelease.fetchRelease(null, (err, projectPath) => {
                if (err) {
                    logger.error(err);
                    return;
                }
                let names = templateRelease.getAvailableTemplateNames(projectPath);
                console.log("Available templates:");
                if (names.length) {
                    names.forEach(n => {
                        console.log(chalk.green.underline(n));
                    })
                } else {
                    console.log("No templates available.");
                }
            })
        }
    })
    .version() // Use package.json's version
    .help()
    .alias({
        "h": "help",
        "v": "version"
    })
    .strict(true)
    .demandCommand()
    .argv;
