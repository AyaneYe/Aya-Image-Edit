# Aya-Image-Edit

Aya~Aya~Aya

# How to run
克隆本仓库后，在目录下运行`npm install`

开发：运行`npm run watch`，会在根目录下生成`dist`文件夹，接着打开 UXP Developer Tools -> Add Plugins，选择`dist\manifest.json`，再点击 Loat & Watch 即可，代码改动后会自动重载

打包：运行`npm run build`会在`dist\`生成Production文件，将其中文件拷贝到%Photoshop Install Folder%\Plug-Ins\%New Folder%\中即可。如需ccx格式安装包，则需在 UXP Developer Tools中找到对应插件->更多选项->点击Package