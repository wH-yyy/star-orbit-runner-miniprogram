// pages/login/login.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    studentId: '',
    password: '',
    loginDisabled: false,
    loginText: '登录',
    studentIdError: false,
    studentIdErrorMsg: '',
    agreementChecked: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 学号输入事件 - 实时验证
   */
  onStudentIdInput(e) {
    const studentId = e.detail.value
    this.setData({
      studentId: studentId
    })
    
    // 实时验证学号格式
    this.validateStudentId(studentId)
  },

  /**
   * 学号失去焦点事件 - 完整验证
   */
  onStudentIdBlur(e) {
    const studentId = e.detail.value
    this.validateStudentId(studentId)
  },

  /**
   * 学号格式验证
   */
  validateStudentId(studentId) {
    if (studentId) {
      if (!/^\d{10}$/.test(studentId)) {
        this.setData({
          studentIdError: true,
          studentIdErrorMsg: '学号必须为10位数字'
        })
        return false
      }
    }
    
    // 验证通过或为空
    this.setData({
      studentIdError: false,
      studentIdErrorMsg: ''
    })
    return true
  },

  /**
   * 密码输入事件
   */
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    })
  },

  /**
   * 登录按钮点击事件
   */
  login() {
    const { studentId, password } = this.data
    
    // 表单验证
    if (!studentId) {
      wx.showToast({
        title: '请输入学号',
        icon: 'none'
      })
      return
    }
    
    // 学号格式验证：10位数字
    if (!/^\d{10}$/.test(studentId)) {
      wx.showToast({
        title: '学号必须为10位数字',
        icon: 'none'
      })
      return
    }
    
    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      })
      return
    }
    
    // 开始登录
    this.setData({
      loginDisabled: true,
      loginText: '登录中...'
    })
    
    // 调用登录接口
    this.loginRequest(studentId, password)
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
   * 登录请求
   */
  loginRequest(studentId, password) {
    // 这里预留登录的后端接口调用
    wx.request({
      url: 'https://your-api-domain.com/api/login', // 后端接口地址
      method: 'POST',
      data: {
        studentId: studentId,
        password: password
      },
      success: (res) => {
        if (res.data.success) {
          wx.showToast({
            title: '登录成功',
          })
          
          // 登录成功后跳转到首页
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/index/index'
            })
          }, 1500)
        } else {
          wx.showToast({
            title: res.data.message || '登录失败',
            icon: 'none'
          })
        }
      },
      fail: () => {
        wx.showToast({
          title: '网络错误，请稍后重试',
          icon: 'none'
        })
      },
      complete: () => {
        // 恢复登录按钮状态
        this.setData({
          loginDisabled: false,
          loginText: '登录'
        })
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