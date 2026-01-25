// app.js
App({
  globalData: {
    userInfo: null,
    hasLogin: false,
    env: "cloud1-5gqrj5sn7b8043df",
  },

  onLaunch: function () {
    this.globalData.userInfo = wx.getStorageSync('userInfo')
    if (this.globalData.userInfo) {
      this.globalData.hasLogin = true;
    }
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
