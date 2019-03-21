package weiui.android.PluginDemo.entry;

import android.content.Context;

import com.taobao.weex.WXSDKEngine;
import com.taobao.weex.common.WXException;

import cc.weiui.framework.extend.annotation.ModuleEntry;
import cc.weiui.framework.extend.bean.WebCallBean;
import weiui.android.PluginDemo.module.WebPluginDemoModule;
import weiui.android.PluginDemo.module.WeexPluginDemoModule;

@ModuleEntry
public class PluginDemoEntry {

    /**
     * APP启动会运行此函数方法
     * @param content Application
     */
    public void init(Context content) {

        //1、注册weex模块
        try {
            WXSDKEngine.registerModule("PluginDemo", WeexPluginDemoModule.class);
        } catch (WXException e) {
            e.printStackTrace();
        }

        //2、注册web模块（weiui_webview模块可通过requireModuleJs调用，调用详见：http://weiui.cc/#/component/weiui_webview）
        WebCallBean.addClassData("PluginDemo", WebPluginDemoModule.class);
    }
    
}
