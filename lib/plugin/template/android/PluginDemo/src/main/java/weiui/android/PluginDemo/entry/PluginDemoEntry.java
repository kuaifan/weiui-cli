package weiui.android.PluginDemo.entry;

import android.content.Context;

import com.taobao.weex.WXSDKEngine;
import com.taobao.weex.common.WXException;

import cc.weiui.framework.extend.annotation.ModuleEntry;
import cc.weiui.framework.extend.bean.WebCallBean;
import weiui.android.PluginDemo.module.WebPluginDemoModule;
import weiui.android.PluginDemo.module.AppPluginDemoModule;

@ModuleEntry
public class PluginDemoEntry {

    /**
     * APP启动会运行此函数方法
     * @param content Application
     */
    public void init(Context content) {

        //1、注册weex模块
        try {
            WXSDKEngine.registerModule("PluginDemo", AppPluginDemoModule.class);
        } catch (WXException e) {
            e.printStackTrace();
        }

        //2、注册web模块（web-view模块可通过requireModuleJs调用，调用详见：https://weiui.app/component/web-view.html）
        WebCallBean.addClassData("PluginDemo", WebPluginDemoModule.class);
    }
    
}
