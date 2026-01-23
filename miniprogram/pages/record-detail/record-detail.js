// pages/record-detail/record-detail.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    record: {}, // 记录详情数据
    loading: true, // 加载状态
    appealReason: '', // 申诉理由
    uploadedImages: [], // 已上传图片列表
    showAppealModal: false // 申诉模态框显示状态
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 从页面参数中获取记录ID
    const id = options.id;
    if (id) {
      // 加载记录详情
      this.loadRecordDetail(id);
    } else {
      // 没有ID参数，返回上一页
      this.goBack();
    }
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
    // 下拉刷新时重新加载数据
    const id = this.data.record.id;
    if (id) {
      this.loadRecordDetail(id);
    }
    wx.stopPullDownRefresh();
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
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.record.images;
    if (images && images.length > 0) {
      wx.previewImage({
        current: images[index],
        urls: images
      });
    }
  },

  /**
   * 加载记录详情
   */
  async loadRecordDetail(id) {
    this.setData({
      loading: true
    });

    try {
      // 从数据库获取记录详情
      const db = wx.cloud.database();
      const res = await db.collection('RunningRecords')
        .doc(id)
        .get();
      
      this.setData({
        record: res.data,
        loading: false
      });
    } catch (error) {
      console.error('加载记录详情失败:', error);
      this.setData({
        loading: false
      });
      wx.showToast({
        title: '加载详情失败',
        icon: 'none'
      });
    }
  },

  /**
   * 显示申诉模态框
   */
  showAppealModal() {
    this.setData({
      showAppealModal: true
    });
  },

  /**
   * 隐藏申诉模态框
   */
  hideAppealModal() {
    if (this.data.appealReason.trim() || this.data.uploadedImages.length > 0) {
      wx.showModal({
        title: '确认取消',
        content: '您的申诉内容尚未提交，确定要取消吗？',
        confirmText: '确定取消',
        cancelText: '继续编辑',
        success: (res) => {
          if (res.confirm) {
            this.setData({
              showAppealModal: false,
              appealReason: '',
              uploadedImages: []
            });
          }
        }
      });
    } else {
      this.setData({
        showAppealModal: false
      });
    }
  },

  /**
   * 申诉理由输入处理
   */
  onAppealReasonInput(e) {
    this.setData({
      appealReason: e.detail.value
    });
  },

  /**
   * 上传图片
   */
  uploadImage() {
    const that = this;
    wx.chooseImage({
      count: 5 - that.data.uploadedImages.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        // 临时文件路径
        const tempFilePaths = res.tempFilePaths;
        
        // 模拟上传到服务器，实际开发中应该调用云函数或API上传
        wx.showLoading({
          title: '图片上传中...',
          mask: true
        });
        
        setTimeout(() => {
          wx.hideLoading();
          // 模拟上传成功，将临时路径添加到已上传列表
          that.setData({
            uploadedImages: [...that.data.uploadedImages, ...tempFilePaths]
          });
          
          wx.showToast({
            title: '图片上传成功',
            icon: 'success',
            duration: 1000
          });
        }, 1500);
      },
      fail(err) {
        console.error('图片选择失败:', err);
        if (err.errMsg !== 'chooseImage:fail cancel') {
          wx.showToast({
            title: '图片选择失败',
            icon: 'none'
          });
        }
      }
    });
  },

  /**
   * 删除图片
   */
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const uploadedImages = [...this.data.uploadedImages];
    uploadedImages.splice(index, 1);
    this.setData({
      uploadedImages: uploadedImages
    });
  },

  /**
   * 提交申诉
   */
  submitAppeal() {
    const { appealReason, uploadedImages, record } = this.data;
    
    // 表单验证
    if (!appealReason.trim()) {
      wx.showToast({
        title: '请输入申诉理由',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '确认申诉',
      content: '确定要提交申诉吗？提交后将重新审核您的跑步记录。',
      confirmText: '确认提交',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 模拟提交申诉
          wx.showLoading({
            title: '申诉提交中...',
            mask: true
          });
          
          setTimeout(() => {
            wx.hideLoading();
            
            wx.showToast({
              title: '申诉已提交，正在重新审核',
              icon: 'success',
              duration: 2000
            });
            
            // 申诉成功后更新状态为审核中
            this.setData({
              record: {
                ...record,
                status: 'pending'
              },
              showAppealModal: false,
              appealReason: '',
              uploadedImages: []
            });
          }, 2000);
        }
      }
    });
  },

  /**
   * 取消申诉
   */
  cancelAppeal() {
    this.hideAppealModal();
  }
})