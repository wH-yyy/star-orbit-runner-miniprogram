// pages/phone-login/phone-login.js
Page({
  data: {
    loginDisabled: false,
    loginText: '微信一键登录',
    agreementChecked: false,
  },

  toggleAgreement() {
    this.setData({
      agreementChecked: !this.data.agreementChecked
    })
  },

  showAgreements() {
    this.openPrivacyContract()
  },

  openPrivacyContract() {
    wx.openPrivacyContract({
      success: () => {
        console.log('打开隐私协议成功')
      },
      fail: (err) => {
        console.error('打开隐私协议失败', err)
        wx.showToast({
          title: '请在微信中打开隐私协议',
          icon: 'none'
        })
      }
    })
  },

  login() {
    if (!this.data.agreementChecked) {
      wx.showToast({
        title: '请勾选服务协议',
        icon: 'error'
      })
      return
    }

    // 显示加载状态
    wx.showLoading({
      title: '登录中',
      mask: true
    })

    // 调用云函数
    wx.cloud.callFunction({
        name: 'login-phone',
        data: null
      })
      .then(res => {
        const result = res.result
        wx.hideLoading()

        switch (result.code) {
          case 200:


            if (result.data.existingStatus) {
              // 已存在账号（针对退出登录后再登录）
              const userInfo = {
                ...result.data.userInfo,
                avatar: result.data.userInfo.gender === '男' ? '/images/male-avatar.jpg' : '/images/female-avatar.jpg'
              }
              wx.setStorageSync('openid', userInfo.openid)
              const app = getApp()
              app.globalData.userInfo = userInfo

              if (userInfo.status === 2) {
                wx.showModal({
                  title: '账号异常',
                  content: '账号被封禁，请联系管理员处理',
                  showCancel: false
                })
                this.setData({
                  loginDisabled: true
                })
              } else {
                wx.showToast({
                  title: '登录成功',
                  icon: 'success'
                })
                setTimeout(() => {
                  wx.switchTab({
                    url: '/pages/submit/submit'
                  })
                }, 1500)
              }
            } else {
              // 新用户
              wx.redirectTo({
                url: '/pages/finish-info/finish-info'
              })
            }
            break;

          case -1:
            wx.showModal({
              title: '登录失败',
              content: '错误码40101,请联系管理员处理',
              showCancel: false
            })
            break;
        }
      }).catch(error => {
        console.error('登录失败:', error)
        wx.hideLoading()
        wx.showModal({
          title: '登录失败',
          content: '错误码40102,请检查网络后重试',
          showCancel: false
        })
      })
  }
})