# GitHub 源码与 Pages

本目录已准备 GitHub Actions 工作流 `.github/workflows/pages.yml`，尚未上传或启用 GitHub Pages。已有 Sites 在线体验保持可用：https://smile-garden-crayon-urnotccw.urnotccw1.chatgpt.site/

1. 在自己的 GitHub 账号下创建 Public 空仓库，建议名称 `smile-garden`。
2. 上传项目源码到 main 分支。包含 `.github/workflows/pages.yml`、vendor 模型、WebP 素材、源码和测试；不上传个人照片、凭据、test-results 或本地 .git。
3. 仓库 Settings → Pages → Build and deployment → Source 选择 GitHub Actions。
4. 首次启用后可在 Actions 手动运行 Publish GitHub Pages。测试、构建和部署成功后，以 GitHub 返回的 Pages 链接为准。

工作流先运行规则测试，再构建并仅发布 dist。无需安装运行时依赖，浏览器开发测试工具不进入网页。模型与素材使用相对路径，兼容仓库子路径。HTTPS 页面首次访问仍需要浏览器摄像头授权。

Pages 不读取 Netlify / Cloudflare 风格的 `_headers`，其缓存和安全响应头由 GitHub 托管层控制；不将本地服务器的响应头验证结果当作 GitHub Pages 的结果。

官方配置参考：[使用自定义工作流部署 GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。本说明不代表部署已经成功。
