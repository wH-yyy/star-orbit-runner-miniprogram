// pages/phone-login/phone-login.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    loginDisabled: false,
    loginText: '微信一键登录',
    agreementChecked: false,
    phoneNumber: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 切换协议勾选状态
   */
  toggleAgreement() {
    this.setData({
      agreementChecked: !this.data.agreementChecked
    })
  },

  /**
   * 显示用户服务协议和隐私政策
   */
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

  /**
   * 获取手机号
   */
  getPhoneNumber(e) {
    console.log('获取手机号事件:', e)
    
    // 检查是否勾选了协议
    if (!this.data.agreementChecked) {
      wx.showToast({
        title: '请先阅读并同意用户协议',
        icon: 'none'
      })
      return
    }
    
    // 检查获取手机号是否成功
    if (e.detail.errMsg === 'getPhoneNumber:fail user deny') {
      wx.showToast({
        title: '请授权手机号登录',
        icon: 'none'
      })
      return
    }
    
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      // 开始登录流程
      this.setData({
        loginDisabled: true,
        loginText: '登录中...'
      })
      
      // 先调用login获取code
      wx.login({
        success: (loginRes) => {
          if (loginRes.code) {
            // 调用云函数进行手机号登录
            this.phoneLogin({
              code: loginRes.code,
              encryptedData: e.detail.encryptedData,
              iv: e.detail.iv
            })
          } else {
            console.error('登录失败:', loginRes.errMsg)
            wx.showToast({
              title: '登录失败，请稍后重试',
              icon: 'none'
            })
            this.setData({
              loginDisabled: false,
              loginText: '微信一键登录'
            })
          }
        },
        fail: (err) => {
          console.error('获取登录凭证失败:', err)
          wx.showToast({
            title: '登录失败，请稍后重试',
            icon: 'none'
          })
          this.setData({
            loginDisabled: false,
            loginText: '微信一键登录'
          })
        }
      })
    }
  },

  /**
   * 手机号登录请求
   */
  phoneLogin(params) {
    console.log('手机号登录请求参数:', params)
    
    // 1. 显示加载中状态
    wx.showLoading({
      title: '登录中...',
      mask: true  // 防止触摸穿透
    })
  
    // 2. 调用云函数
    wx.cloud.callFunction({
      name: 'phoneLogin',  // 云函数名称
      data: params,  // 传递给云函数的参数
      success: res => {
        const result = res.result
        console.log('手机号登录结果:', result)
        
        // 3. 根据返回码处理结果
        switch(result.code) {
          case 200:
            // 登录成功
            wx.showToast({
              title: '登录成功',
              icon: 'success'
            });
            
            // 保存手机号到本地，用于显示
            this.setData({
              phoneNumber: result.data.phoneNumber
            })
            
            // 跳转到tabBar首页
            setTimeout(() => {
              wx.switchTab({
                url: '/pages/home/home'
              });
            }, 1500);
            break;
          case 401:
            wx.showToast({
              title: '登录失败，请重试',
              icon: 'none'
            });
            break;
          case 500:
            wx.showToast({
              title: '服务器错误，请稍后重试',
              icon: 'none'
            });
            break;
          default:
            wx.showToast({
              title: result.message || '登录失败',
              icon: 'none'
            });
        }
      },
      fail: err => {
        console.error('调用云函数失败:', err)
        // 4. 网络错误处理
        wx.showToast({
          title: '网络错误，请检查网络连接',
          icon: 'none'
        })
      },
      complete: () => {
        wx.hideLoading();
        // 恢复按钮状态
        this.setData({
          loginDisabled: false,
          loginText: '微信一键登录'
        });
      }
    })
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})