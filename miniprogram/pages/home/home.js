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

  /**
   * 页面显示时重新加载数据
   */
  onShow() {
    console.log('=== Home页面显示，重新加载用户信息 ===')
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
            value:  userInfo.totalDuration + 'min',
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
    console.log('=== 开始退出登录 ===')
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        console.log('退出登录确认结果:', res)
        if (res.confirm) {
          console.log('用户确认退出登录')
          
          // 清除本地存储
          console.log('清除本地存储前的userInfo:', wx.getStorageSync('userInfo'))
          wx.clearStorageSync()
          console.log('清除本地存储后的userInfo:', wx.getStorageSync('userInfo'))
          
          // 重置全局数据
          const app = getApp()
          console.log('重置前的全局数据:', app.globalData)
          if (app.globalData) {
            app.globalData.userInfo = null
            app.globalData.hasLogin = false
          }
          console.log('重置后的全局数据:', app.globalData)
          
          // 显示退出成功提示
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 500
          })
          
          // 立即跳转到手机号一键登录页面
          console.log('准备跳转到手机号一键登录页面')
          setTimeout(() => {
            console.log('执行跳转到手机号一键登录页面')
            wx.redirectTo({
              url: '/pages/phone-login/phone-login',
              success: function(res) {
                console.log('跳转到手机号登录页面成功:', res)
              },
              fail: function(res) {
                console.error('跳转到手机号登录页面失败:', res)
                // 如果redirectTo失败，尝试使用navigateTo
                wx.navigateTo({
                  url: '/pages/phone-login/phone-login',
                  success: function(res) {
                    console.log('使用navigateTo跳转到手机号登录页面成功:', res)
                  },
                  fail: function(res) {
                    console.error('使用navigateTo跳转到手机号登录页面也失败:', res)
                  }
                })
              }
            })
          }, 500)
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