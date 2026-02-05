// pages/record-detail/record-detail.js
Page({
  data: {
    record: {}, // 记录详情数据
    loading: true, // 加载状态
    appealReason: '', // 申诉理由
    uploadedImages: [], // 已上传图片列表
    showAppealModal: false // 申诉模态框显示状态
  },

  onLoad(options) {
    // 从页面参数中获取记录ID
    const id = options.id;
    if (id) {
      this.loadRecordDetail(id);
    } else {
      wx.showToast({
        title: '加载失败：没有记录ID',
        icon: 'none'
      });
      setTimeout(() => {
        this.goBack();
      }, 1500);
    }
  },

  onPullDownRefresh() {
    const id = this.data.record.id;
    if (id) {
      this.loadRecordDetail(id);
    } else {
      wx.showToast({
        title: '刷新失败：未找到记录',
        icon: 'none'
      });
    }
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 500);
  },

  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  previewImage(e) {
    const imageFileID = this.data.record.imageFileID;
    if (imageFileID) {
      wx.previewImage({
        current: imageFileID,
        urls: [imageFileID]
      });
    }
  },

  loadRecordDetail(id) {
    this.setData({
      loading: true
    });

    const db = wx.cloud.database();
    db.collection('RunningRecords')
      .doc(id)
      .get()
      .then(res => {
        const recordData = res.data;
        if (!recordData) {
          this.setData({
            loading: false
          });
          wx.showToast({
            title: '加载详情失败：未找到记录',
            icon: 'none'
          });
          setTimeout(() => {
            this.goBack();
          }, 1500);
          return;
        }
        
        if (recordData.status !== undefined) {
          recordData.status = parseInt(recordData.status);
        }
        
        if (recordData.audit_reason) {
          let reason = recordData.audit_reason.toLowerCase();
          if (reason.includes('ocr') || reason.includes('识别')) {
            recordData.displayAuditReason = '学号和姓名不匹配';
          } else {
            recordData.displayAuditReason = recordData.audit_reason;
          }
        } else {
          recordData.displayAuditReason = '未提供具体原因';
        }

        // 处理创建时间格式
        if (recordData.create_time) {
          
          const createTime = new Date(recordData.create_time);
          // 格式化日期和时间
          const year = createTime.getFullYear();
          const month = String(createTime.getMonth() + 1).padStart(2, '0');
          const day = String(createTime.getDate()).padStart(2, '0');
          const hours = String(createTime.getHours()).padStart(2, '0');
          const minutes = String(createTime.getMinutes()).padStart(2, '0');
          const seconds = String(createTime.getSeconds()).padStart(2, '0');
          
          // 创建完整的显示时间，用于打卡时间显示
          recordData.display_time = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } else {
          recordData.display_time = '--';
        }
        
        // 添加记录ID到数据中，用于下拉刷新
        recordData.id = id;
        
        this.setData({
          record: recordData,
          loading: false
        });
      })
      .catch(error => {
        console.error('加载记录详情失败:', error);
        this.setData({
          loading: false
        });
        wx.showToast({
          title: '加载详情失败',
          icon: 'none'
        });
      });
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
        
        wx.showLoading({
          title: '图片上传中...',
          mask: true
        });
        
        // 实际上传图片到云存储
        const uploadTasks = tempFilePaths.map((tempFilePath, index) => {
          const fileName = `appeals/${getApp().globalData.userInfo.openid}_${Date.now()}_${index}.jpg`;
          return wx.cloud.uploadFile({
            cloudPath: fileName,
            filePath: tempFilePath
          });
        });
        
        Promise.all(uploadTasks)
          .then(uploadResults => {
            wx.hideLoading();
            // 获取上传成功的FileID
            const fileIDs = uploadResults.map(result => result.fileID);
            // 将FileID添加到已上传列表
            that.setData({
              uploadedImages: [...that.data.uploadedImages, ...fileIDs]
            }, () => {
              wx.showToast({
                title: '图片上传成功',
                icon: 'success',
                duration: 1000
              });
            });
          })
          .catch(error => {
            wx.hideLoading();
            console.error('图片上传失败:', error);
            wx.showToast({
              title: '图片上传失败',
              icon: 'none'
            });
          });
      },
      fail(err) {
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
          wx.showLoading({
            title: '申诉提交中...',
            mask: true
          });
          
          // 调用云函数提交申诉
          wx.cloud.callFunction({
            name: 'submitAppeal',
            data: {
              runningRecordId: record._id,
              appealReason: appealReason.trim(),
              appealImages: uploadedImages
            }
          })
          .then(res => {
            wx.hideLoading();
            
            if (res.result && res.result.success) {
              wx.showToast({
                title: res.result.message || '申诉已提交，正在重新审核',
                icon: 'success',
                duration: 2000
              });
              
              // 申诉成功后更新状态为审核中
              this.setData({
                record: {
                  ...record,
                  status: 2
                },
                showAppealModal: false,
                appealReason: '',
                uploadedImages: []
              });
            } else {
              wx.showToast({
                title: res.result.message || '申诉提交失败，请稍后重试',
                icon: 'none',
                duration: 2000
              });
            }
          })
          .catch(error => {
            wx.hideLoading();
            console.error('申诉提交失败:', error);
            wx.showToast({
              title: '网络错误，请稍后重试',
              icon: 'none',
              duration: 2000
            });
          });
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