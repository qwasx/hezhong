# Contributing · 参与贡献

Thanks for helping! 感谢参与！

- Run the tests before sending a PR / 提交前跑测试：`node test/run.mjs`
- No runtime dependencies, please — the server, SDK and CLI only use Node / browser built-ins. 请不要引入运行时依赖。
- User-facing text comes in English **and** Chinese (server errors, storefront, panel, docs). 面向用户的文字中英都要有。
- Format rules live in `sdk/validate.js`; change them only together with the docs and a version bump of the format. 格式规则改动要同步文档并升格式版本。
- Security issues: please open a private advisory instead of a public issue. 安全问题请走私密通报，不要公开提 issue。
