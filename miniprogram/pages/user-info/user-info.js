// pages/user-info/user-info.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 用户信息
    userInfo: {
      name: '',
      studentId: '',
      gender: '',
      campus: '',
      className: '',
      college: '',
      phone: ''
    },
    // 性别选项
    genderOptions: ['男', '女'],
    genderIndex: 0,
    // 校区选项
    campusOptions: ['兴庆校区', '雁塔校区', '曲江校区', '创新港'],
    campusIndex: 0,
    // 书院选项
    collegeOptions: ['仲英书院', '文治书院', '彭康书院', '启德书院', '励志书院', '崇实书院', '南洋书院', '宗濂书院', '厚德书院'],
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
    showConfirmPassword: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.loadUserInfo()
  },

  /**
   * 加载用户信息
   */
  async loadUserInfo() {
    try {
      wx.showLoading({ title: '加载中...' })

      // 从全局数据或本地存储获取用户学号
      const app = getApp()
      const studentId = app.globalData.userInfo?.studentId || wx.getStorageSync('studentId')

      if (!studentId) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
        return
      }

      // 从数据库获取用户信息
      const db = wx.cloud.database()
      const res = await db.collection('Users')
        .where({
          stu_id: studentId
        })
        .get()

      if (res.data.length > 0) {
        const userData = res.data[0]
        // 设置picker的index
        const genderIndex = this.data.genderOptions.indexOf(userData.gender)
        const campusIndex = this.data.campusOptions.indexOf(userData.campus)
        const collegeIndex = this.data.collegeOptions.indexOf(userData.college)

        this.setData({
          userInfo: {
            name: userData.name,
            studentId: userData.stu_id,
            gender: userData.gender,
            campus: userData.campus,
            className: userData.class_name,
            college: userData.college,
            phone: userData.phone
          },
          genderIndex: genderIndex >= 0 ? genderIndex : 0,
          campusIndex: campusIndex >= 0 ? campusIndex : 0,
          collegeIndex: collegeIndex >= 0 ? collegeIndex : 0
        })
      }

      wx.hideLoading()
    } catch (error) {
      console.error('加载用户信息失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 输入框变化处理
   */
  onInputChange(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`userInfo.${field}`]: e.detail.value
    })
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
    this.setData({
      isChangingPassword: !this.data.isChangingPassword,
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
   * 验证手机号格式
   */
  validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone)
  },

  /**
   * 验证密码格式
   */
  validatePassword(password) {
    return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#$%&-_]{8,20}$/.test(password)
  },

  /**
   * 保存用户信息
   */
  async saveUserInfo() {
    const { userInfo, isChangingPassword, passwordData } = this.data

    // 基本信息验证
    if (!userInfo.name || !userInfo.gender || !userInfo.campus ||
        !userInfo.className || !userInfo.college || !userInfo.phone) {
      wx.showToast({
        title: '请填写完整信息',
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

    // 如果修改密码，进行密码验证
    if (isChangingPassword) {
      if (!passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        wx.showToast({
          title: '请填写完整的密码信息',
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

      // 调用云函数更新用户信息
      const updateParams = {
        studentId: userInfo.studentId,
        name: userInfo.name,
        gender: userInfo.gender,
        campus: userInfo.campus,
        className: userInfo.className,
        college: userInfo.college,
        phone: userInfo.phone
      }

      // 如果修改密码，添加密码参数
      if (isChangingPassword) {
        updateParams.oldPassword = passwordData.oldPassword
        updateParams.newPassword = passwordData.newPassword
      }

      const res = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: updateParams
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })

        // 更新全局用户信息
        const app = getApp()
        if (app.globalData.userInfo) {
          app.globalData.userInfo = {
            ...app.globalData.userInfo,
            name: userInfo.name,
            gender: userInfo.gender,
            campus: userInfo.campus,
            className: userInfo.className,
            college: userInfo.college,
            phone: userInfo.phone
          }
        }

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
  }
})