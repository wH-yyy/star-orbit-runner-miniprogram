// app.js
App({
  globalData: {
    userInfo: null,
  },

  onLaunch: function () {
    this.globalData = {
      env: "cloud1-5gqrj5sn7b8043df",
      // 全局用户信息 - 对应数据库Users表结构
      userInfo: {
        _id: '',              // 数据库文档ID
        openid: '',           // 微信openid
        stu_id: '',           // 学号
        name: '',             // 姓名
        gender: '',           // 性别
        campus: '',           // 校区
        class_name: '',       // 班级
        college: '',          // 书院
        phone: '',            // 手机号
        password: '',         // 密码（仅用于验证，不应在前端存储）
        avatar: '',           // 头像URL（云存储URL或微信头像URL）
        totalCount: 0,        // 总跑步次数
        totalDuration: 0,     // 总跑步时长（秒）
        totalDistance: 0,     // 总跑步距离（米）
        createTime: '',       // 创建时间
        updateTime: ''        // 更新时间
      }
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },
});
