// pages/register/register.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    codeText: '获取验证码',
    counting: false,
    phone: '',
    code: '',
    password: '',
    confirmPassword: ''
  },
  
  // 手机号输入
  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    })
  },
  
  // 验证码输入
  onCodeInput(e) {
    this.setData({
      code: e.detail.value
    })
  },
  
  // 密码输入
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    })
  },
  
  // 确认密码输入
  onConfirmPasswordInput(e) {
    this.setData({
      confirmPassword: e.detail.value
    })
  },
  
  // 获取验证码 
  getCode() {
    var that = this;
    const phone = that.data.phone;
    
    // 手机号验证
    if (!phone) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      })
      return;
    }
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      })
      return;
    }
    
    if (!that.data.counting) {
      // 调用获取验证码接口
      that.getVerificationCode(phone);
      
      // 开始倒计时60秒
      that.countDown(that, 60);
    } 
  },
  
  // 调用获取验证码接口
  getVerificationCode(phone) {
    // 这里预留获取验证码的后端接口调用
    wx.request({
      url: 'https://your-api-domain.com/api/send-code', // 后端接口地址
      method: 'POST',
      data: {
        phone: phone
      },
      success: function(res) {
        if (res.data.success) {
          wx.showToast({
            title: '验证码已发送',
          })
        } else {
          wx.showToast({
            title: res.data.message || '发送失败',
            icon: 'none'
          })
        }
      },
      fail: function() {
        wx.showToast({
          title: '网络错误，请稍后重试',
          icon: 'none'
        })
      }
    })
  },
  
  // 倒计时60秒
  countDown(that, count) {
    if (count == 0) {
      that.setData({
        codeText: '获取验证码',
        counting: false
      })
      return;
    }
    that.setData({
      counting: true,
      codeText: count + '秒后重新获取',
    })
    setTimeout(function() {
      count--;
      that.countDown(that, count);
    }, 1000);
  },
  
  // 注册
  register() {
    const { phone, code, password, confirmPassword } = this.data;
    
    // 表单验证
    if (!phone) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      })
      return;
    }
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      })
      return;
    }
    
    if (!code) {
      wx.showToast({
        title: '请输入验证码',
        icon: 'none'
      })
      return;
    }
    
    if (code.length !== 6) {
      wx.showToast({
        title: '请输入6位验证码',
        icon: 'none'
      })
      return;
    }
    
    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      })
      return;
    }
    
    if (password.length < 6) {
      wx.showToast({
        title: '密码长度不能少于6位',
        icon: 'none'
      })
      return;
    }
    
    if (password !== confirmPassword) {
      wx.showToast({
        title: '两次输入的密码不一致',
        icon: 'none'
      })
      return;
    }
    
    // 调用注册接口
    this.registerUser(phone, code, password);
  },
  
  // 调用注册接口
  registerUser(phone, code, password) {
    // 这里预留注册的后端接口调用
    wx.request({
      url: 'https://your-api-domain.com/api/register', // 后端接口地址
      method: 'POST',
      data: {
        phone: phone,
        code: code,
        password: password
      },
      success: function(res) {
        if (res.data.success) {
          wx.showToast({
            title: '注册成功',
          })
          // 注册成功后跳转到登录页面
          setTimeout(() => {
            wx.navigateTo({
              url: '/pages/login/login'
            })
          }, 1500);
        } else {
          wx.showToast({
            title: res.data.message || '注册失败',
            icon: 'none'
          })
        }
      },
      fail: function() {
        wx.showToast({
          title: '网络错误，请稍后重试',
          icon: 'none'
        })
      }
    })
  },
  
  // 跳转到登录页面
  toLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },
  
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

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