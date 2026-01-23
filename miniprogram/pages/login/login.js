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
    // 1. 显示加载中状态
    wx.showLoading({
      title: '登录中...',
      mask: true
    })
  
    // 2. 调用云函数
    wx.cloud.callFunction({
      name: 'login',  // 云函数名称
      data: {  // 传递给云函数的参数
        account: studentId,
        password: password
      },
      success: res => {
        const result = res.result
        
        // 3. 根据返回码处理结果
        switch(result.code) {
          case 200:
            // 登录成功 - 保存用户信息（规范字段名）
            const userInfo = result.data.userInfo
            
            console.log('=== 登录成功，返回的用户信息 ===')
            console.log('userInfo:', userInfo)
            console.log('学号:', userInfo.stu_id)
            console.log('姓名:', userInfo.name)
            
            // 保存到本地存储 - 使用规范的数据库字段名
            wx.setStorageSync('stu_id', userInfo.stu_id)
            wx.setStorageSync('userInfo', {
              _id: userInfo._id,
              stu_id: userInfo.stu_id,
              name: userInfo.name,
              gender: userInfo.gender,
              campus: userInfo.campus,
              class_name: userInfo.class_name,
              college: userInfo.college,
              phone: userInfo.phone,
              avatar: userInfo.avatar || '',
              totalCount: userInfo.totalCount || 0,
              totalDuration: userInfo.totalDuration || 0,
              totalDistance: userInfo.totalDistance || 0
            })
            
            console.log('已保存到本地存储:', wx.getStorageSync('userInfo'))
            
            // 保存到全局数据 - 使用规范的数据库字段名
            const app = getApp()
            app.globalData.userInfo = {
              _id: userInfo._id,
              stu_id: userInfo.stu_id,
              name: userInfo.name,
              gender: userInfo.gender,
              campus: userInfo.campus,
              class_name: userInfo.class_name,
              college: userInfo.college,
              phone: userInfo.phone,
              avatar: userInfo.avatar || '',
              totalCount: userInfo.totalCount || 0,
              totalDuration: userInfo.totalDuration || 0,
              totalDistance: userInfo.totalDistance || 0
            }
            
            console.log('已保存到全局数据:', app.globalData.userInfo)
            
            wx.showToast({
              title: '登录成功',
              icon: 'success'
            })
            
            // 延迟跳转，让用户看到成功提示
            setTimeout(() => {
              wx.switchTab({
                url: '/pages/home/home'
              })
            }, 1000)
            break
          case 401:
            wx.showToast({
              title: '账号或密码错误',
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
        wx.hideLoading()
        // 4. 网络错误处理
        wx.showToast({
          title: '网络错误，请检查网络连接',
          icon: 'none'
        })
        // 恢复按钮状态
        this.setData({
          loginDisabled: false,
          loginText: '登录'
        })
      },
      complete: () => {
        // 恢复按钮状态
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