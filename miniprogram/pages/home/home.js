// pages/home/home.js
const userInfoHelper = require('../utils/userInfoHelper');

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
        id: 'appeal',
        name: '申诉历史',
        icon: ''
      },
      {
        id: 'help',
        name: '帮助与反馈',
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
        // 跳转到我的奖项页面
        wx.navigateTo({
          url: '/pages/awards/awards'
        });
        break;
      case 'appeal':
        // 跳转到申诉历史页面
        wx.navigateTo({
          url: '/pages/appeal-history/appeal-history'
        });
        break;
      case 'help':
        // 跳转到帮助与反馈页面
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
        break;
      case 'logout':
        this.handleLogout();
        break;
    }
  }
})