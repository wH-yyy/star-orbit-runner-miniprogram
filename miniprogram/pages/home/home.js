// pages/home/home.js
const userHelper = require('../utils/userInfoHelper');

Page({
  data: {
    userInfo : {},
    stats: [
      {
        value: '0 次',
        label: '打卡记录'
      },
      {
        value: '0 km',
        label: '累计里程'
      },
      {
        value: '0 min',
        label: '运动时长'
      }
    ],
    menuItems: [
      {
        id: 'edit',
        name: '个人信息',
        icon: ''
      },
      {
        id: 'awards',
        name: '我的奖项',
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

  onPullDownRefresh() {
    userInfoHelper.refreshUserInfo()
    this.loadUserInfo()
    wx.stopPullDownRefresh()
  },

  loadUserInfo() {
    try {
      const app = getApp()
      const userInfo = app.globalData.userInfo
      
      this.setData({
        userInfo: userInfo,
        stats: [
          {
            value: userInfo.totalCount + ' 次',
            label: '打卡记录'
          },
          {
            value: userInfo.totalDistance + ' km',
            label: '累计里程'
          },
          {
            value:  userInfo.totalDuration,
            label: '运动时长'
          }
        ]
      })
    } catch (error) {
      console.error('加载用户信息失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  navigateToUserInfo() {
    wx.navigateTo({
      url: '/pages/user-info/user-info'
    })
  },

  navigateToRecord() {
    wx.switchTab({
      url: '/pages/record/record'
    })
  },

  navigateToAwards() {
    wx.navigateTo({
      url: '/pages/awards/awards'
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
            icon: 'success'
          })
          
          // 重启到登录页
          setTimeout(() => {
            wx.relaunch({
              url: '/pages/phone-login/phone-login'
            })
          }, 1500)
        }
      }
    })
  },

  /**
   * 菜单点击事件
   */
  handleMenuClick(e) {
    const id = e.currentTarget.dataset.id;
    switch(id) {
      case 'edit':
        // 跳转到编辑个人信息页面
        this.navigateToUserInfo();
        break;
      case 'awards':
        // 跳转到我的奖项页面
        this.navigateToAwards();
        break;
      case 'help':
        // 跳转到帮助与反馈页面
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        })
        break;
      case 'logout':
        // 退出登录逻辑
        this.handleLogout();
        break;
      default:
        break;
    }
  }
})