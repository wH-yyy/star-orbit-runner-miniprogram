// pages/user-info/user-info.js
Page({
  data: {
    userInfo: {},
    // 性别选项
    genderOptions: ['男', '女'],
    genderIndex: 0,
    // 校区选项
    campusOptions: ['兴庆校区', '雁塔校区', '曲江校区', '创新港校区'],
    campusIndex: 0,
    // 书院选项
    collegeOptions: ['仲英书院', '文治书院', '彭康书院', '启德书院', '励志书院', '崇实书院', '南洋书院', '宗濂书院', '钱学森书院'],
    collegeIndex: 0,
    // 是否正在修改密码
    isChangingPassword: false,
    // 密码信息
    passwordData: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    },
    // 是否显示密码
    showOldPassword: false,
    showNewPassword: false,
    showConfirmPassword: false,
    // 换绑手机号相关
    isChangingPhone: false,
    newPhone: '',
    verificationCode: '',
    countdown: 0,
    isValidPhone: false,
    // 忘记密码相关
    isForgotPassword: false,
    forgotPasswordCode: '',
    forgotPasswordCountdown: 0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    const app = getApp()
    this.setData({
      userInfo: app.globalData.userInfo
    })
  },

  // name，class_name输入框变化处理
  onInputChange(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`userInfo.${field}`]: e.detail.value
    })
  },

  /**
   * 选择并上传头像
   */
  async chooseAvatar() {
    try {
      // 选择图片
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'] // 压缩图片
      })

      const tempFilePath = res.tempFiles[0].tempFilePath
      
      wx.showLoading({ title: '上传中...' })

      // 上传到云存储
      const fileName = `avatars/${this.data.userInfo.openid}_${Date.now()}.jpg`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: fileName,
        filePath: tempFilePath
      })

      // 直接使用fileID（推荐）
      // 小程序会自动将 cloud:// 转换为可访问的URL
      const fileID = uploadRes.fileID

      // 更新界面显示
      this.setData({
        'userInfo.avatar': fileID  // 存储 cloud:// 格式的fileID
      })

      wx.hideLoading()
      wx.showToast({
        title: '头像已选择',
        icon: 'success'
      })

    } catch (error) {
      console.error('选择头像失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '选择头像失败',
        icon: 'none'
      })
    }
  },

  /**
   * 性别选择变化
   */
  onGenderChange(e) {
    this.setData({
      genderIndex: e.detail.value,
      'userInfo.gender': this.data.genderOptions[e.detail.value]
    })
  },

  /**
   * 校区选择变化
   */
  onCampusChange(e) {
    this.setData({
      campusIndex: e.detail.value,
      'userInfo.campus': this.data.campusOptions[e.detail.value]
    })
  },

  /**
   * 书院选择变化
   */
  onCollegeChange(e) {
    this.setData({
      collegeIndex: e.detail.value,
      'userInfo.college': this.data.collegeOptions[e.detail.value]
    })
  },

  /**
   * 切换密码修改状态
   */
  togglePasswordChange() {
    const newIsChangingPassword = !this.data.isChangingPassword
    this.setData({
      isChangingPassword: newIsChangingPassword,
      // 只有在关闭密码修改表单时，才重置忘记密码相关状态
      isForgotPassword: newIsChangingPassword ? this.data.isForgotPassword : false,
      forgotPasswordCode: newIsChangingPassword ? this.data.forgotPasswordCode : '',
      forgotPasswordCountdown: newIsChangingPassword ? this.data.forgotPasswordCountdown : 0,
      passwordData: {
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      }
    })
  },

  /**
   * 密码输入变化
   */
  onPasswordInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`passwordData.${field}`]: e.detail.value
    })
  },

  /**
   * 切换密码可见性
   */
  togglePasswordVisibility(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [field]: !this.data[field]
    })
  },

  /**
   * 验证班级格式
   */
  validateClassName(className) {
    return className && className.trim().length > 0
  },

  /**
   * 验证手机号格式：1[3-9]开头，共11位数字
   */
  validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone)
  },

  /**
   * 验证密码格式：包含字母和数字，8-20位
   */
  validatePassword(password) {
    return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#$%&-_]{8,20}$/.test(password)
  },

  /**
   * 显示换绑手机号确认弹窗
   */
  showChangePhoneConfirm() {
    console.log('=== 点击了手机号区域，显示换绑确认弹窗 ===')
    wx.showModal({
      title: '换绑手机号',
      content: '确定要换绑手机号吗？',
      success: (res) => {
        if (res.confirm) {
          console.log('用户确认换绑手机号')
          this.startChangePhone()
        } else {
          console.log('用户取消换绑手机号')
        }
      },
      fail: (error) => {
        console.error('显示弹窗失败:', error)
      }
    })
  },

  /**
   * 开始换绑手机号
   */
  startChangePhone() {
    console.log('=== 开始换绑手机号流程 ===')
    this.setData({
      isChangingPhone: true,
      newPhone: '',
      verificationCode: '',
      countdown: 0,
      isValidPhone: false
    })
    console.log('设置isChangingPhone为true，现在应该显示换绑表单')
  },

  /**
   * 新手机号输入
   */
  onNewPhoneInput(e) {
    const newPhone = e.detail.value
    const isValidPhone = this.validatePhone(newPhone)
    
    this.setData({
      newPhone,
      isValidPhone
    })
  },

  /**
   * 验证码输入
   */
  onVerificationCodeInput(e) {
    this.setData({
      verificationCode: e.detail.value
    })
  },

  /**
   * 获取验证码
   */
  async getVerificationCode() {
    console.log('=== 点击了获取验证码按钮 ===')
    const { newPhone } = this.data
    console.log('当前手机号:', newPhone)
    
    // 手机号验证
    if (!newPhone) {
      console.log('手机号为空')
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      })
      return
    }
    
    if (!this.validatePhone(newPhone)) {
      console.log('手机号格式不正确')
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      })
      return
    }
    
    if (this.data.countdown > 0) {
      console.log('正在倒计时，不能重复获取')
      return
    }
    
    try {
      wx.showLoading({ title: '发送中...' })
      
      // 检查云开发是否初始化
      if (!wx.cloud) {
        console.error('云开发未初始化！')
        wx.hideLoading()
        wx.showModal({
          title: '错误',
          content: '云开发未初始化，请检查app.js中的云开发配置',
          showCancel: false
        })
        return
      }
      
      // 调用云函数发送验证码
      const res = await wx.cloud.callFunction({
        name: 'sendVerificationCode',
        data: {
          phone: newPhone
        }
      })
      
      wx.hideLoading()
      console.log('✅ 云函数调用成功！')
      console.log('完整返回结果:', JSON.stringify(res, null, 2))
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '验证码已发送',
          icon: 'success'
        })
        
        // 开始倒计时
        this.startCountdown()
        
        // 开发环境下显示验证码（生产环境删除）
        if (res.result.devCode) {
          console.log('==========================================')
          console.log('🔑 验证码（测试用）:', res.result.devCode)
          console.log('==========================================')
        }
      } else {
        console.error('❌ 云函数返回失败:', res.result)
        wx.showToast({
          title: res.result.message || '发送失败',
          icon: 'none',
          duration: 2000
        })
        
      }
    } catch (error) {
      wx.hideLoading()
      console.error('❌ 云函数调用失败:', error)
      console.error('错误详情:', JSON.stringify(error, null, 2))
      
      let errorMsg = '网络错误，请稍后重试'
      
      // 详细的错误提示
      if (error.errMsg) {
        if (error.errMsg.includes('cloud function execution error')) {
          errorMsg = '云函数执行错误，请检查云函数是否已上传'
        } else if (error.errMsg.includes('cloud.callFunction:fail')) {
          errorMsg = '调用失败，请检查云函数名称和部署状态'
        }
      }
      
      wx.showModal({
        title: '调用失败',
        content: errorMsg + '\n\n详细信息请查看控制台',
        showCancel: false
      })
      
    }
  },

  /**
   * 开始倒计时
   */
  startCountdown() {
    this.setData({ countdown: 60 })
    this.countdownTimer()
  },

  /**
   * 倒计时计时器
   */
  countdownTimer() {
    const { countdown } = this.data
    
    if (countdown > 0) {
      setTimeout(() => {
        this.setData({ countdown: countdown - 1 })
        this.countdownTimer()
      }, 1000)
    }
  },

  /**
   * 取消换绑手机号
   */
  cancelChangePhone() {
    this.setData({
      isChangingPhone: false,
      newPhone: '',
      verificationCode: '',
      countdown: 0,
      isValidPhone: false
    })
  },

  /**
   * 确认换绑手机号
   */
  async confirmChangePhone() {
    const { newPhone, verificationCode } = this.data
    
    // 验证手机号和验证码
    if (!this.validatePhone(newPhone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      })
      return
    }
    
    if (!verificationCode || verificationCode.length !== 6) {
      wx.showToast({
        title: '请输入6位验证码',
        icon: 'none'
      })
      return
    }
    
    try {
      wx.showLoading({ title: '验证中...' })
      
      // 调用云函数验证验证码
      const res = await wx.cloud.callFunction({
        name: 'verifyCode',
        data: {
          phone: newPhone,
          code: verificationCode
        }
      })
      
      if (res.result.success) {
        // 更新用户手机号
        this.setData({
          'userInfo.phone': newPhone,
          isChangingPhone: false,
          newPhone: '',
          verificationCode: '',
          countdown: 0,
          isValidPhone: false
        })
        
        wx.hideLoading()
        wx.showToast({
          title: '手机号更换成功',
          icon: 'success'
        })
        
        // 更新全局用户信息
        const app = getApp()
        if (app.globalData.userInfo) {
          app.globalData.userInfo.phone = newPhone
        }
      } else {
        wx.hideLoading()
        wx.showToast({
          title: res.result.message || '验证码错误',
          icon: 'none'
        })
        
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '验证失败，请稍后重试',
        icon: 'none'
      })
      
    }
  },

  /**
   * 开始忘记密码流程
   */
  startForgotPassword() {
    this.setData({
      isChangingPassword: true,
      isForgotPassword: true,
      forgotPasswordCode: '',
      forgotPasswordCountdown: 0
    })
  },

  /**
   * 取消忘记密码
   */
  cancelForgotPassword() {
    this.setData({
      isForgotPassword: false,
      forgotPasswordCode: '',
      forgotPasswordCountdown: 0
    })
  },

  /**
   * 忘记密码验证码输入
   */
  onForgotPasswordCodeInput(e) {
    this.setData({
      forgotPasswordCode: e.detail.value
    })
  },

  /**
   * 获取忘记密码验证码
   */
  async getForgotPasswordCode() {
    console.log('=== 点击了获取忘记密码验证码按钮 ===')
    const { userInfo } = this.data
    const phone = userInfo.phone
    console.log('当前手机号:', phone)
    
    // 手机号验证
    if (!phone) {
      console.log('手机号为空')
      wx.showToast({
        title: '手机号不能为空',
        icon: 'none'
      })
      return
    }
    
    if (!this.validatePhone(phone)) {
      console.log('手机号格式不正确')
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'none'
      })
      return
    }
    
    if (this.data.forgotPasswordCountdown > 0) {
      console.log('正在倒计时，不能重复获取')
      return
    }
    
    try {
      wx.showLoading({ title: '发送中...' })
      
      // 检查云开发是否初始化
      if (!wx.cloud) {
        console.error('云开发未初始化！')
        wx.hideLoading()
        wx.showModal({
          title: '错误',
          content: '云开发未初始化，请检查app.js中的云开发配置',
          showCancel: false
        })
        return
      }
      
      // 调用云函数发送验证码
      const res = await wx.cloud.callFunction({
        name: 'sendVerificationCode',
        data: {
          phone: phone
        }
      })
      
      wx.hideLoading()
      console.log('✅ 云函数调用成功！')
      console.log('完整返回结果:', JSON.stringify(res, null, 2))
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '验证码已发送',
          icon: 'success'
        })
        
        // 开始倒计时
        this.startForgotPasswordCountdown()
                
        // 开发环境下显示验证码（生产环境删除）
        if (res.result.devCode) {
          console.log('==========================================')
          console.log('🔑 验证码（测试用）:', res.result.devCode)
          console.log('==========================================')
        }
      } else {
        console.error('❌ 云函数返回失败:', res.result)
        wx.showToast({
          title: res.result.message || '发送失败',
          icon: 'none',
          duration: 2000
        })
        
      }
    } catch (error) {
      wx.hideLoading()
      console.error('❌ 云函数调用失败:', error)
      console.error('错误详情:', JSON.stringify(error, null, 2))
      
      let errorMsg = '网络错误，请稍后重试'
      
      // 详细的错误提示
      if (error.errMsg) {
        if (error.errMsg.includes('cloud function execution error')) {
          errorMsg = '云函数执行错误，请检查云函数是否已上传'
        } else if (error.errMsg.includes('cloud.callFunction:fail')) {
          errorMsg = '调用失败，请检查云函数名称和部署状态'
        }
      }
      
      wx.showModal({
        title: '调用失败',
        content: errorMsg + '\n\n详细信息请查看控制台',
        showCancel: false
      })
      
    }
  },

  /**
   * 开始忘记密码倒计时
   */
  startForgotPasswordCountdown() {
    this.setData({ forgotPasswordCountdown: 60 })
    this.forgotPasswordCountdownTimer()
  },

  /**
   * 忘记密码倒计时计时器
   */
  forgotPasswordCountdownTimer() {
    const { forgotPasswordCountdown } = this.data
    
    if (forgotPasswordCountdown > 0) {
      setTimeout(() => {
        this.setData({ forgotPasswordCountdown: forgotPasswordCountdown - 1 })
        this.forgotPasswordCountdownTimer()
      }, 1000)
    }
  },

  /**
   * 保存用户信息
   */
  async saveUserInfo() {
    const { userInfo, isChangingPassword, passwordData, isForgotPassword, forgotPasswordCode } = this.data
    
    console.log('保存用户信息，当前状态:', {
      isChangingPassword,
      isForgotPassword
    })
    
    // 1. 忘记密码模式：单独处理，不涉及旧密码
    if (isForgotPassword) {
      console.log('进入忘记密码模式处理')
      return this.saveForgotPassword()
    }
    
    // 2. 普通保存逻辑：包含正常密码修改和信息更新
    // 基本信息验证
    if (!userInfo.name || !userInfo.gender || !userInfo.campus ||
        !userInfo.class_name || !userInfo.college || !userInfo.phone) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    // 班级格式验证
    if (!this.validateClassName(userInfo.class_name)) {
      wx.showToast({
        title: '班级信息不能为空',
        icon: 'none'
      })
      return
    }

    // 手机号格式验证
    if (!this.validatePhone(userInfo.phone)) {
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'none'
      })
      return
    }

    // 如果修改密码，进行密码验证（仅正常修改密码模式）
    if (isChangingPassword) {
      if (!passwordData.oldPassword) {
        wx.showToast({
          title: '请输入旧密码',
          icon: 'none'
        })
        return
      }
      
      if (!passwordData.newPassword || !passwordData.confirmPassword) {
        wx.showToast({
          title: '请填写完整的新密码信息',
          icon: 'none'
        })
        return
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        wx.showToast({
          title: '两次输入的新密码不一致',
          icon: 'none'
        })
        return
      }

      if (!this.validatePassword(passwordData.newPassword)) {
        wx.showToast({
          title: '新密码必须包含字母和数字，长度8-20位',
          icon: 'none'
        })
        return
      }
    }

    try {
      wx.showLoading({ title: '保存中...' })

      // 确保学号存在
      if (!userInfo.stu_id) {
        wx.hideLoading()
        wx.showToast({
          title: '用户信息不完整，请重新登录',
          icon: 'none'
        })
        return
      }

      // 调用云函数更新用户信息（包含正常密码修改）
      const updateParams = {
        _id: userInfo._id,
        stu_id: userInfo.stu_id,
        name: userInfo.name,
        gender: userInfo.gender,
        campus: userInfo.campus,
        class_name: userInfo.class_name,
        college: userInfo.college,
        phone: userInfo.phone,
        avatar: userInfo.avatar  // 添加头像URL
      }

      // 调试：输出更新参数
      console.log('更新用户信息参数:', updateParams)

      // 如果修改密码，添加密码参数
      if (isChangingPassword) {
        updateParams.oldPassword = passwordData.oldPassword
        updateParams.newPassword = passwordData.newPassword
        updateParams.mode = 'normal_change_password'
      }

      console.log('调用云函数updateUserInfo，参数:', updateParams)
      const res = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: updateParams
      })

      console.log('更新结果:', res)
      wx.hideLoading()
      console.log('云函数返回结果:', JSON.stringify(res, null, 2))

      if (res.result && res.result.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })

        // 更新全局用户信息
        const app = getApp()
        if (app.globalData.userInfo) {
          app.globalData.userInfo = userInfo
        }

        // 同时更新本地存储
        wx.setStorageSync('userInfo', userInfo)

        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({
          title: res.result.message || '保存失败',
          icon: 'none',
          duration: 2000
        })
      }

    } catch (error) {
      console.error('保存用户信息失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '保存失败，请稍后重试',
        icon: 'none'
      })
    }
  },
  
  /**
   * 单独处理忘记密码模式的密码修改
   */
  async saveForgotPassword() {
    const { userInfo, passwordData, forgotPasswordCode } = this.data
    
    // 忘记密码模式验证
    if (!userInfo.phone) {
      wx.showToast({
        title: '手机号不能为空',
        icon: 'none'
      })
      return
    }
    
    if (!forgotPasswordCode || forgotPasswordCode.length !== 6) {
      wx.showToast({
        title: '请输入6位验证码',
        icon: 'none'
      })
      return
    }
    
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      wx.showToast({
        title: '请填写完整的新密码信息',
        icon: 'none'
      })
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      wx.showToast({
        title: '两次输入的新密码不一致',
        icon: 'none'
      })
      return
    }

    if (!this.validatePassword(passwordData.newPassword)) {
      wx.showToast({
        title: '新密码必须包含字母和数字，长度8-20位',
        icon: 'none'
      })
      return
    }
    
    try {
      wx.showLoading({ title: '保存中...' })
      
      // 确保学号存在
      if (!userInfo.stu_id) {
        wx.hideLoading()
        wx.showToast({
          title: '用户信息不完整，请重新登录',
          icon: 'none'
        })
        return
      }
      
      // 忘记密码模式：仅传递必要参数，完全不涉及oldPassword
      const forgotPasswordParams = {
        // 身份认证信息
        stu_id: userInfo.stu_id,
        phone: userInfo.phone,
        // 忘记密码核心参数
        newPassword: passwordData.newPassword,
        verificationCode: forgotPasswordCode,
        // 明确标识这是忘记密码模式
        mode: 'forgot_password',
        isForgotPassword: true
      }
      
      console.log('调用云函数updateUserInfo（忘记密码模式），参数:', forgotPasswordParams)
      const res = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: forgotPasswordParams
      })
      
      wx.hideLoading()
      console.log('云函数返回结果:', JSON.stringify(res, null, 2))
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '密码修改成功',
          icon: 'success'
        })
        
        // 忘记密码修改成功，强制重新登录
        setTimeout(() => {
          wx.showToast({
            title: '密码修改成功，请重新登录',
            icon: 'none'
          })
          
          // 清除登录状态
          const app = getApp()
          app.globalData.userInfo = null
          wx.removeStorageSync('studentId')
          
          // 跳转到登录页面
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/phone-login/phone-login'
            })
          }, 1500)
        }, 1500)
      } else {
        wx.showToast({
          title: res.result.message || '修改失败',
          icon: 'none',
          duration: 2000
        })
      }
    } catch (error) {
      console.error('修改密码失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '修改失败，请稍后重试',
        icon: 'none'
      })
    }
  },
})