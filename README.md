# weiui-cli

> weiui-cli 是 配合 weiui 框架使用的命令行工具

# 命令行使用

## 安装

```bash
npm i weiui-cli -g
```

## 更新

```bash
npm update weiui-cli -g
```

如果出现`permission denied`等相关权限的错误提示，请使用管理员身份或root身份运行，如 mac：`sudo npm i weiui-cli -g`。

## 使用


#### 创建应用

```bash
weiui create [projectName]
```

- projectName: 工程名称（选题，默认：weiui_demo）


#### 查询版本

```bash
weiui lists              // 显示可create的版本
```

#### 安装插件

```bash
weiui plugin <command> <pluginName>
```

- command: 命令（安装：install，卸载uninstall，创建create，发布publish）
- pluginName: 插件名称（插件列表可以查看[https://weiui.app/](https://weiui.app/)）

#### 版本及帮助

```bash
weiui -v    // 查看当前cli版本
weiui -h    // 命令帮助信息
```
