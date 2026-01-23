// pages/phone-login/phone-login.js
Page({
  data: {
    loginDisabled: false,
    loginText: '微信一键登录',
    agreementChecked: false,
    phoneNumber: ''
  },

  toggleAgreement() {
    this.setData({
      agreementChecked: !this.data.agreementChecked
    })
  },

  showAgreements() {
    wx.showModal({
      title: '服务协议及隐私政策',
      content: '这里是用户服务协议和隐私政策的具体内容，详细说明了用户在使用本服务时的权利和义务，以及我们如何收集、使用和保护用户的个人信息...',
      showCancel: true,
      cancelText: '关闭',
      confirmText: '我已阅读',
      success: (res) => {
        if (res.confirm) {
          // 用户确认阅读后，可以自动勾选协议
          this.setData({
            agreementChecked: true
          })
        }
      }
    })
  },

  async login() {
    if (!this.data.agreementChecked) {
      wx.showToast({
        title: '请勾选服务协议',
        icon: 'error'
      })
      return
    }
    try {
      // 显示加载状态
      wx.showLoading({
        title: '登录中...',
        mask: true
      })
      
      // 调用云函数
      const res = await wx.cloud.callFunction({
        name: 'login-phone',
        data: null
      })
      
      const result = res.result
      wx.hideLoading()
      
      switch(result.code) {
        case 200:
          // 先显示成功提示
          await wx.showToast({
            title: '登录成功',
            icon: 'success',
            duration: 1500
          })
          
          // 延迟跳转，让用户看到提示
          setTimeout(() => {
            if (result.data.existingStatus) {
              const userInfo = result.data.userInfo              
              wx.setStorageSync('userInfo', userInfo)
              const app = getApp()
              app.globalData.userInfo = userInfo
              
              // 检查是否是tabBar页面
              wx.switchTab({
                url: '/pages/home/home'
              })
              console.log("userInfo:", app.globalData.userInfo)
            } else {
              wx.navigateTo({
                url: '/pages/user-info/user-info'
              })
            }
          }, 1500)
          break;
          
        case -1:
          wx.showToast({
            title: '登录失败，请重试',
            icon: 'error',
            duration: 2000
          })
          break;
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '网络异常，请检查网络',
        icon: 'error',
        duration: 2000
      })
      console.error('登录失败:', error)
    }
  }
})