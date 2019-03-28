

Pod::Spec.new do |s|

 

  s.name         = "PluginDemo"
  s.version      = "1.0.0"
  s.summary      = "weiui plugin."
  s.description  = <<-DESC
                    weiui plugin.
                   DESC

  s.homepage     = "https://weiui.app"
  s.license      = "MIT"
  s.author             = { "veryitman" => "aipaw@live.cn" }
  s.source =  { :path => '.' }
  s.source_files  = "PluginDemo", "**/**/*.{h,m,mm,c}"
  s.exclude_files = "Source/Exclude"
  s.resources = 'PluginDemo/resources/*.*'
  s.platform     = :ios, "8.0"
  s.requires_arc = true

  s.dependency 'WeexSDK'
  s.dependency 'weiui'
  s.dependency 'WeexPluginLoader', '~> 0.0.1.9.1'
  
end
