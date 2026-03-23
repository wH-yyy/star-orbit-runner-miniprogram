// pages/home/home.js
Page({
  data: {
    userInfo: {},
    menuItems: [{
        id: 'awards',
        name: '我的奖项',
        icon: '../../images/award.svg'
      },
      {
        id: 'appeal',
        name: '申诉历史',
        icon: '../../images/appeal.svg'
      },
      {
        id: 'logout',
        name: '退出登录',
        icon: '../../images/logout.svg'
      }
    ]
  },

  onLoad() {
    const app = getApp()
    // 登录检查
    if (!app.globalData.userInfo.openid) {
      wx.showToast({
        icon: 'error',
        title: '请先登录',
      })
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/phone-login/phone-login',
        })
      }, 1000)
      return
    }
    // 完善个人信息检查
    if (!app.globalData.userInfo.class_name || !app.globalData.userInfo.college || !app.globalData.userInfo.gender || !app.globalData.userInfo.name || !app.globalData.userInfo.campus) {
      wx.showToast({
        icon: 'error',
        title: '请完善个人信息',
      })
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/finish-info/finish-info',
        })
      }, 1000)
      return
    }
    this.setData({
      userInfo: app.globalData.userInfo,
    })
  },

  handleMenuClick(e) {
    const id = e.currentTarget.dataset.id;
    switch (id) {
      case 'awards':
        wx.navigateTo({
          url: '/pages/awards/awards'
        });
        break;
      case 'appeal':
        wx.navigateTo({
          url: '/pages/appeal-history/appeal-history'
        });
        break;
      case 'logout':
        this.handleLogout();
        break;
    }
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          const app = getApp()
          app.globalData.userInfo = {}
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
          })
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/submit/submit'
            })
          }, 1000)
        }
      }
    })
  }
})