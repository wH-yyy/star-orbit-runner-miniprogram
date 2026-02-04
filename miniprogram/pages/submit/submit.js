// pages/submit/submit.js
Page({
  data: {
    // 图片（用于预览展示：临时路径）
    images: [],
    maxImages: 1,
    imageError: false,
    imageErrorMsg: '',

    // 跑步方式选择
    modeOptions: ['全程在操场/在操场跑四圈', '在任意场地跑，提供步数截图'],
    modeIndex: 0,

    // 提交状态
    submitting: false,
    submitDisabled: false,
    submitTextIndex: 0,
    submitTextList: ['提交记录', '未到提交时间', '今日停跑'],

    // 成功弹窗
    showSuccess: false
  },

  onLoad() {
    // this.checkSubmissionAvailability()
  },

  onShow() {
    // this.checkSubmissionAvailability()
  },

  checkSubmissionAvailability() {
    // TODO: 检查今天是否停跑
    // 检查现在的时间是不是晚上8点到10点之间
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = 20 * 60;
    const endMinutes = 22 * 60 + 5;
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      this.setData({
        submitDisabled: true,
        submitTextIndex: 1
      })
    }
  },

  onModeChange(e) {
    this.setData({
      modeIndex: Number(e.detail.value || 0)
    })
  },

  async chooseImage() {
    if (this.data.submitting) return
    if (!wx.cloud) {
      wx.showModal({
        title: '错误',
        content: '云开发未初始化，请检查app.js中的wx.cloud.init',
        showCancel: false
      })
      return
    }

    try {
      const remain = this.data.maxImages - this.data.images.length
      if (remain <= 0) return

      const res = await wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed']
      })

      const tempFiles = res.tempFiles || []
      if (tempFiles.length === 0) return

      // 只在本地展示预览，不在这里上传；上传放到提交时统一处理
      const newImages = tempFiles.map(f => f.tempFilePath)
      this.setData({
        images: [...this.data.images, ...newImages],
        imageError: false,
        imageErrorMsg: ''
      })
    } catch (error) {
      console.error('选择/上传图片失败:', error)
      if (error && error.errMsg && error.errMsg.includes('cancel')) return
      wx.showToast({ title: '图片上传失败', icon: 'none' })
    } finally {
      // 这里不涉及上传，不需要 loading 状态恢复
    }
  },

  deleteImage(e) {
    if (this.data.submitting) return
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return

    const images = [...this.data.images]
    images.splice(index, 1)

    this.setData({ images })
  },

  validateForm() {
    let ok = true

    if (!this.data.images || this.data.images.length === 0) {
      ok = false
      this.setData({
        imageError: true,
        imageErrorMsg: '请上传跑步记录截图'
      })
    } else {
      this.setData({
        imageError: false,
        imageErrorMsg: ''
      })
    }

    return ok
  },

  async submitForm() {
    if (this.data.submitting) return
    if (!this.validateForm()) return

    if (!wx.cloud) {
      wx.showModal({
        title: '错误',
        content: '云开发未初始化，请检查app.js中的wx.cloud.init',
        showCancel: false
      })
      return
    }

    const mode = this.data.modeOptions[this.data.modeIndex] || ''

    try {
      this.setData({
        submitting: true,
        submitDisabled: true,
        submitText: '提交中...'
      })
      wx.showLoading({ title: '上传中...', mask: true })

      // 1. 上传首张截图到云存储
      const tempFilePath = this.data.images[0]
      const cloudPath = `running-records/${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath
      })
      const fileID = uploadRes.fileID

      wx.hideLoading()

      // 2. 前端视角：上传成功即视为提交成功
      this.setData({
        images: [],
        imageError: false,
        imageErrorMsg: '',
        showSuccess: true
      })

      // 3. 在后台触发 OCR + 审核，不阻塞用户
      wx.cloud
        .callFunction({
          name: 'uploadRunningRecord',
          data: { fileID, mode, ocrProvider: 'auto' }
        })
        .then(res => {
          console.log('后台OCR审核完成:', res)
        })
        .catch(err => {
          console.error('后台OCR审核失败:', err)
        })
    } catch (error) {
      console.error('提交失败:', error)
      wx.hideLoading()
      wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' })
    } finally {
      this.setData({
        submitting: false,
        submitDisabled: false,
        submitText: '提交审核'
      })
    }
  },

  onSuccessClose() {
    this.setData({ showSuccess: false })
    wx.navigateBack({ delta: 1 })
  },

  preventTouchMove() {}
})