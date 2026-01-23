// pages/user-info/user-info.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 用户信息 - 对应数据库Users表
    userInfo: {
      _id: '',              // 数据库文档ID
      stu_id: '',           // 学号
      name: '',             // 姓名
      gender: '',           // 性别
      campus: '',           // 校区
      class_name: '',       // 班级
      college: '',          // 书院
      phone: '',            // 手机号
      avatar: '',           // 头像URL
      totalCount: 0,        // 总跑步次数
      totalDuration: 0,     // 总跑步时长
      totalDistance: 0      // 总跑步距离
    },
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
    // 计算后的统计数据
    totalDistanceKm: '0.00',
    totalDurationMinutes: '0'
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
      const stuId = app.globalData.userInfo?.stu_id || wx.getStorageSync('stu_id')

      console.log('=== 加载用户信息 ===')
      console.log('全局userInfo:', app.globalData.userInfo)
      console.log('本地存储stu_id:', wx.getStorageSync('stu_id'))
      console.log('获取到的stu_id:', stuId)

      if (!stuId) {
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
          stu_id: stuId
        })
        .get()

      console.log('数据库查询结果:', res)

      if (res.data.length > 0) {
        const userData = res.data[0]
        console.log('用户数据:', userData)
        
        // 设置picker的index
        const genderIndex = this.data.genderOptions.indexOf(userData.gender)
        const campusIndex = this.data.campusOptions.indexOf(userData.campus)
        const collegeIndex = this.data.collegeOptions.indexOf(userData.college)

        this.setData({
          userInfo: {
            _id: userData._id,
            stu_id: userData.stu_id,
            name: userData.name,
            gender: userData.gender,
            campus: userData.campus,
            class_name: userData.class_name,
            college: userData.college,
            phone: userData.phone,
            avatar: userData.avatar || '',
            totalCount: userData.totalCount || 0,
            totalDuration: userData.totalDuration || 0,
            totalDistance: userData.totalDistance || 0
          },
          genderIndex: genderIndex >= 0 ? genderIndex : 0,
          campusIndex: campusIndex >= 0 ? campusIndex : 0,
          collegeIndex: collegeIndex >= 0 ? collegeIndex : 0,
          totalDistanceKm: ((userData.totalDistance || 0) / 1000).toFixed(2),
          totalDurationMinutes: Math.round((userData.totalDuration || 0) / 60).toString()
        })
        
        console.log('设置后的userInfo:', this.data.userInfo)
      } else {
        console.error('未找到用户数据')
        wx.showToast({
          title: '未找到用户信息',
          icon: 'none'
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
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次显示页面时重新加载用户数据（防止从提交页面返回后数据不更新）
    this.loadUserInfo()
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
      const fileName = `avatars/${this.data.userInfo.stu_id}_${Date.now()}.jpg`
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
   * 保存用户信息
   */
  async saveUserInfo() {
    const { userInfo, isChangingPassword, passwordData } = this.data

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
      }

      const res = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: updateParams
      })

      console.log('更新结果:', res)
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
            _id: userInfo._id,
            stu_id: userInfo.stu_id,
            name: userInfo.name,
            gender: userInfo.gender,
            campus: userInfo.campus,
            class_name: userInfo.class_name,
            college: userInfo.college,
            phone: userInfo.phone,
            avatar: userInfo.avatar
          }
        }

        // 同时更新本地存储
        wx.setStorageSync('stu_id', userInfo.stu_id)

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