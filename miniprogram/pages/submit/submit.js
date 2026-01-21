// pages/submit/submit.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 跑步数据
    date: '',
    locationIndex: 0,
    locationOptions: ['全程在操场上跑四圈', '在校园内其他地方跑'],
    images: [],
    
    // 表单验证
    dateError: false,
    dateErrorMsg: '',
    imageError: false,
    imageErrorMsg: '',
    
    // 上传配置
    maxImages: 3,
    
    // 提交状态
    submitDisabled: false,
    submitText: '提交记录',
    showSuccess: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 初始化默认日期时间为当前时间，精确到分钟
    const now = new Date()
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}`
    
    this.setData({
      date: formattedDateTime
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

  },
  
  /**
   * 跑步地点变化事件
   */
  onLocationChange(e) {
    this.setData({
      locationIndex: e.detail.value
    })
  },
  
  /**
   * 日期选择器 - 用户不可更改，所以禁用
   */
  onDatePicker() {
    // 用户不可更改时间，所以不需要实现任何功能
  },
  
  /**
   * 表单验证 - 跑步日期
   */
  validateDate(value) {
    if (!value) {
      this.setData({
        dateError: true,
        dateErrorMsg: '请选择跑步日期'
      })
      return false
    }
    
    this.setData({
      dateError: false,
      dateErrorMsg: ''
    })
    return true
  },
  
  /**
   * 表单验证 - 跑步截图
   */
  validateImages(images) {
    if (images.length === 0) {
      this.setData({
        imageError: true,
        imageErrorMsg: '请至少上传一张跑步截图'
      })
      return false
    }
    
    this.setData({
      imageError: false,
      imageErrorMsg: ''
    })
    return true
  },
  
  /**
   * 选择图片
   */
  chooseImage() {
    const that = this
    const maxCount = this.data.maxImages - this.data.images.length
    
    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success(res) {
        console.log('选择图片成功:', res)
        
        // 处理选择的图片
        const tempFiles = res.tempFiles
        const newImages = tempFiles.map(file => file.tempFilePath)
        
        // 更新图片列表
        that.setData({
          images: [...that.data.images, ...newImages]
        })
        
        // 验证图片
        that.validateImages(that.data.images)
      },
      fail(err) {
        console.error('选择图片失败:', err)
        if (err.errMsg !== 'chooseMedia:fail cancel') {
          wx.showToast({
            title: '选择图片失败，请重试',
            icon: 'none'
          })
        }
      }
    })
  },
  
  /**
   * 删除图片
   */
  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.images
    images.splice(index, 1)
    
    this.setData({
      images: images
    })
    
    // 验证图片
    this.validateImages(images)
  },
  
  /**
   * 上传图片到云存储
   */
  uploadImages() {
    const that = this
    const images = this.data.images
    const uploadPromises = []
    
    // 上传每张图片
    for (let i = 0; i < images.length; i++) {
      const filePath = images[i]
      const cloudPath = `running-records/${Date.now()}-${i}.${filePath.match(/\.(\w+)$/)[1]}`
      
      const promise = new Promise((resolve, reject) => {
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath,
          success: res => {
            resolve(res.fileID)
          },
          fail: err => {
            console.error('上传图片失败:', err)
            reject(err)
          }
        })
      })
      
      uploadPromises.push(promise)
    }
    
    return Promise.all(uploadPromises)
  },
  
  /**
   * 表单提交
   */
  submitForm() {
    // 表单验证
    const isDateValid = this.validateDate(this.data.date)
    const isImagesValid = this.validateImages(this.data.images)
    
    if (!isDateValid || !isImagesValid) {
      wx.showToast({
        title: '请完善表单信息',
        icon: 'none'
      })
      return
    }
    
    // 开始提交
    this.setData({
      submitDisabled: true,
      submitText: '提交中...'
    })
    
    // 显示加载状态
    wx.showLoading({
      title: '提交中...',
      mask: true
    })
    
    const that = this
    
    // 1. 上传图片到云存储
    this.uploadImages()
      .then(fileIDs => {
        console.log('图片上传成功:', fileIDs)
        
        // 2. 调用云函数提交跑步记录
        return wx.cloud.callFunction({
          name: 'submitRunningRecord',
          data: {
            date: that.data.date,
            location: that.data.locationOptions[that.data.locationIndex],
            images: fileIDs
          }
        })
      })
      .then(res => {
        console.log('提交记录成功:', res)
        
        // 隐藏加载状态
        wx.hideLoading()
        
        // 显示成功提示
        that.setData({
          showSuccess: true
        })
        
        // 重置表单
        that.resetForm()
      })
      .catch(err => {
        console.error('提交失败:', err)
        
        // 隐藏加载状态
        wx.hideLoading()
        
        // 显示错误提示
        wx.showToast({
          title: '提交失败，请稍后重试',
          icon: 'none'
        })
        
        // 恢复提交状态
        that.setData({
          submitDisabled: false,
          submitText: '提交记录'
        })
      })
  },
  
  /**
   * 重置表单
   */
  resetForm() {
    // 重新设置当前日期时间，精确到分钟
    const now = new Date()
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}`
    
    // 重置表单数据
    this.setData({
      date: formattedDateTime,
      locationIndex: 0,
      images: [],
      
      // 重置表单验证
      dateError: false,
      dateErrorMsg: '',
      imageError: false,
      imageErrorMsg: '',
      
      // 重置提交状态
      submitDisabled: false,
      submitText: '提交记录'
    })
  },
  
  /**
   * 关闭成功提示
   */
  onSuccessClose() {
    this.setData({
      showSuccess: false
    })
  },
  
  /**
   * 阻止模态框背景滚动
   */
  preventTouchMove() {
    // 阻止模态框背景滚动
  }
})