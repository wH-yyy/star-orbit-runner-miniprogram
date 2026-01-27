module.exports = {
  refreshUserInfo
};

const refreshUserInfo = async () => {
  try {
    const app = getApp()
    const db = wx.cloud.database()
    const res = await db.collection('Users')
      .where({
        openid: app.globalData.userInfo.openid
      })
      .get()
    if (res.data.length > 0) {
      app.globalData.userInfo = res.data[0]
      wx.setStorageSync('userInfo', res.data[0])
    }
  } catch (error) {
    wx.showToast({
      title: '刷新失败，请检查网络连接状态',
      icon: 'error',
    })
  }
}
