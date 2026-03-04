// pages/launch/launch.js
Page({
  async onLoad() {
    const app = getApp()

    try {
      if (app.globalData.hasLogin) {
        const result = await this.fetchUserInfo(app.globalData.userInfo.openid)
        if (result) {
          const status = result.status
          if (status === 0) {
            wx.switchTab({
              url: '/pages/submit/submit'
            })
          } else {
            wx.showModal({
              title: '账号异常',
              content: '账号被封禁，请联系管理员处理',
              showCancel: false
            })
          }
        }
      } else {
        wx.reLaunch({
          url: '/pages/phone-login/phone-login'
        })
      }
    } catch (err) {
      console.error('启动页发生错误', err)
    }
  },

  async fetchUserInfo(openid) {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('Users')
        .where({
          openid: openid
        })
        .get()

      if (res.data.length > 0) {
        // const userInfo = res.data[0]
        const userInfo = {
          ...res.data[0],
          avatar: res.data[0].gender === '男'? '/images/male-avatar.jpg' : '/images/female-avatar.jpg'
        }
        const app = getApp()
        app.globalData.userInfo = userInfo
        return userInfo
      } else {
        // 用户不存在（可能已被管理员删除），清除登录状态并跳转登录页
        app.globalData.userInfo = {}
        app.globalData.hasLogin = false
        wx.clearStorageSync()
        wx.showModal({
          title: '提示',
          content: '账号不存在，请重新登录',
          showCancel: false,
          confirmText: '去登录',
          success() {
            wx.reLaunch({
              url: '/pages/phone-login/phone-login'
            });
          }
        })
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
      wx.showModal({
        title: '加载错误',
        content: '无法获取用户信息，请检查网络后重试',
        showCancel: false,
        confirmText: '重试'
      })
    }

    return null
  }
})