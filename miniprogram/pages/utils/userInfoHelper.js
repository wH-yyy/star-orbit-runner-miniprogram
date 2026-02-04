// pages/utils/userInfoHelper.js

const refreshUserInfo = async () => {
  try {
    const app = getApp()
    const db = wx.cloud.database()
    const res = await db.collection('Users')
      .doc(app.globalData.userInfo._id)
      .get()
    if (res.data) {
      const userInfo = {
        ...res.data,
        avatar: res.data.gender === '男'? '/images/male-avatar.png' : '/images/female-avatar.png'
      }
      app.globalData.userInfo = userInfo
      wx.setStorageSync('userInfo', userInfo)
    }
  } catch (error) {
    wx.showToast({
      title: '刷新失败，请检查网络连接状态',
      icon: 'error',
    })
  }
}

module.exports = {
  refreshUserInfo
};