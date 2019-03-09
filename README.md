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

## 使用


#### 创建应用

```bash
weiui create [projectName]
```

- projectName: 工程名称（选题，默认：weiui_demo）


#### 查询版本

```bash
weiui list              // 显示可用的版本
```

#### 安装插件

```bash
weiui plugin <command> <name>
```

- command: 命令（安装：install，卸载uninstall）
- name: 插件名称（插件列表可以查看[https://weiui.cc/](https://weiui.cc/)）

#### 版本及帮助

```bash
weiui -v    // 查看当前toolkit版本

weiui -h    // 命令帮助信息
```
