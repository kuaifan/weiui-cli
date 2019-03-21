//
//  PluginDemoModule.m
//  Pods
//

#import "PluginDemoModule.h"
#import <WeexPluginLoader/WeexPluginLoader.h>

@interface PluginDemoModule ()

@end

@implementation PluginDemoModule

WX_PlUGIN_EXPORT_MODULE(PluginDemo, PluginDemoModule)
WX_EXPORT_METHOD(@selector(simple:))
WX_EXPORT_METHOD(@selector(call:callback:))
WX_EXPORT_METHOD_SYNC(@selector(retMsg:))

//简单
- (void)simple:(NSString*)msg
{
    NSLog(@"日志输出：%@", msg);
}

//回调演示
- (void)call:(NSString*)msg callback:(WXModuleKeepAliveCallback)callback
{
    if (callback != nil) {
        callback([@"返回" stringByAppendingString:msg], NO);
    }
}

//同步返回
- (NSString*)retMsg:(NSString*)msg
{
    return [@"返回" stringByAppendingString:msg];
}

@end
