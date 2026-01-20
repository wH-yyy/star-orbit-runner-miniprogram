// pages/register/register.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    codeText: '获取验证码',
    counting: false,
    phone: '',
    studentId: '',
    name: '',
    gender: '',
    campusIndex: 0,
    campusList: ['(请选择)', '兴庆校区', '雁塔校区', '创新港校区'],
    class: '',
    collegeIndex: 0,
    collegeList: ['(请选择)', '彭康书院', '文治书院', '宗濂书院', '南洋书院', '崇实书院', '仲英书院', '励志书院', '启德书院', '钱学森书院'],
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
  
  // 学号输入
  onStudentIdInput(e) {
    this.setData({
      studentId: e.detail.value
    })
  },
  
  // 姓名输入
  onNameInput(e) {
    this.setData({
      name: e.detail.value
    })
  },
  
  // 性别选择
  onGenderChange(e) {
    this.setData({
      gender: e.detail.value
    })
  },
  
  // 校区选择
  onCampusChange(e) {
    this.setData({
      campusIndex: e.detail.value
    })
  },
  
  // 班级输入
  onClassInput(e) {
    this.setData({
      class: e.detail.value
    })
  },
  
  // 书院选择
  onCollegeChange(e) {
    this.setData({
      collegeIndex: e.detail.value
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
      url: 'https://your-api-domain.com/api/send-code', // 后端接口地址（需要修改）
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
    const { phone, studentId, name, gender, campusIndex, campusList, class: className, collegeIndex, collegeList, code, password, confirmPassword } = this.data;
    
    console.log('用户点击了注册按钮！'); // 调试信息
    console.log('campusIndex = ', campusIndex);
    console.log('collegeIndex = ', collegeIndex);

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
    
    if (!studentId) {
      wx.showToast({
        title: '请输入学号',
        icon: 'none'
      })
      return;
    }
    
    if (studentId.length !== 10) {
      wx.showToast({
        title: '学号长度必须为10位',
        icon: 'none'
      })
      return;
    }
    
    if (!name) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      })
      return;
    }
    
    if (!gender) {
      wx.showToast({
        title: '请选择性别',
        icon: 'none'
      })
      return;
    }
    
    if (!className) {
      wx.showToast({
        title: '请输入班级',
        icon: 'none'
      })
      return;
    }
    
    // 校区验证
    if (campusIndex === 0) {
      console.log('请选择校区');
      wx.showToast({
        title: '请选择校区',
        icon: 'none'
      })
      return;
    }
    
    // 书院验证
    if (collegeIndex === 0) {
      console.log('请选择书院');
      wx.showToast({
        title: '请选择书院',
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
    
    // 密码必须包含字母和数字，可以包含@#$%&-_，长度8-20位
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#$%&-_]{8,20}$/;
    if (!passwordRegex.test(password)) {
      wx.showToast({
        title: '密码必须包含字母和数字，可包含@#$%&-_，长度8-20位',
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
    
    // 获取校区和书院名称
    const campus = campusList[campusIndex];
    const college = collegeList[collegeIndex];
    
    // 调用注册接口
    this.registerUser(phone, studentId, name, gender, campus, className, college, code, password);
  },
  
  // 调用注册接口
  registerUser(phone, studentId, name, gender, campus, className, college, code, password) {
    // 这里预留注册的后端接口调用
    wx.request({
      url: 'https://your-api-domain.com/api/register', // 后端接口地址
      method: 'POST',
      data: {
        phone: phone,
        studentId: studentId,
        name: name,
        gender: gender,
        campus: campus,
        class: className,
        college: college,
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