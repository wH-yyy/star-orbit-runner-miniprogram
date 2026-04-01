// pages/launch/launch.js
Page({
  async onLoad() {
    wx.showLoading({
      title: '小程序启动中'
    })
    const app = getApp()
    app.globalData.userInfo.openid = wx.getStorageSync('openid')

    try {
      if (app.globalData.userInfo.openid) {
        const result = await this.fetchUserInfo(app.globalData.userInfo.openid)
        if (result) {
          const status = result.status
          if (status === 2) {
            wx.showModal({
              title: '账号异常',
              content: '账号被封禁，请联系管理员处理',
              showCancel: false
            })
          } else {
            wx.switchTab({
              url: '/pages/submit/submit'
            })
          }
        }
      } else {
        wx.switchTab({
          url: '/pages/submit/submit',
        })
      }
    } catch (err) {
      console.error('启动页发生错误', err)
    } finally {
      wx.hideLoading()
    }
  },

  async fetchUserInfo(openid) {
    try {
      const app = getApp()
      const db = wx.cloud.database()
      const res = await db.collection('Users')
        .where({
          openid: openid
        })
        .get()

      if (res.data.length > 0) {
        const userInfo = {
          ...res.data[0],
          avatar: res.data[0].gender === '男'? '/images/male-avatar.jpg' : '/images/female-avatar.jpg'
        }
        app.globalData.userInfo = userInfo
        return userInfo
      } else {
        app.globalData.userInfo = {}
        wx.clearStorageSync()
        wx.showModal({
          title: '提示',
          content: '原账号已不存在',
          showCancel: false,
          success() {
            wx.switchTab({
              url: '/pages/submit/submit',
            })
          }
        })
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
      wx.showModal({
        title: '加载错误',
        content: '无法获取用户信息，请检查网络后重试',
        showCancel: false
      })
    }
    return null
  }
})