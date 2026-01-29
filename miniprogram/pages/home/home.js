// pages/home/home.js
const userHelper = require('../utils/userInfoHelper');

Page({
  data: {
    userInfo : {},
    menuItems: [
      {
        id: 'awards',
        name: '我的奖项',
        icon: ''
      },
      {
        id: 'logout',
        name: '退出登录',
        icon: ''
      }
    ]
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    this.loadUserInfo()
  },

  onPullDownRefresh() {
    userInfoHelper.refreshUserInfo()
    this.loadUserInfo()
    wx.stopPullDownRefresh()
  },

  loadUserInfo() {
    this.setData({
      userInfo: getApp().globalData.userInfo,
    })
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          const app = getApp()
          if (app.globalData) {
            app.globalData.userInfo = null
            app.globalData.hasLogin = false
          }
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
          })
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/phone-login/phone-login'
            })
          }, 1000)
        }
      }
    })
  },

  handleMenuClick(e) {
    const id = e.currentTarget.dataset.id;
    switch(id) {
      case 'awards':
        wx.navigateTo({
          url: '/pages/awards/awards'
        })
        break;
      case 'logout':
        this.handleLogout();
        break;
    }
  }
})