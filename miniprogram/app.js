// app.js
App({
  globalData: {
    userInfo: {},
    hasLogin: false,
    env: "cloud1-5gqrj5sn7b8043df",
  },

  onLaunch() {
    const openid = wx.getStorageSync('openid')
    if (openid) {
      this.globalData.hasLogin = true
      this.globalData.userInfo.openid = openid
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
