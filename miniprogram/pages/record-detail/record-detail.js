Page({
  data: {
    record: {}, // 记录详情数据
    appeal: null, // 申诉详情数据
    loading: true, // 加载状态
    appealReason: '', // 申诉理由
    uploadedImages: [], // 已上传图片列表
    showAppealModal: false, // 申诉模态框显示状态
    canModifyImage: false,//是否可修改图片
    hasLoadedOnce: false//是否加载过图片
  },

  onLoad(options) {
    const { index, recordId } = options;
    if (index) {
      this.loadFromRecordPage(index);
    } else if (recordId) {
      this.loadFromCloud(recordId);
    } else {
      this.showErrorAndBack('参数错误，无法加载记录');
    }
  },
  
  loadFromRecordPage(index) {
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    
    if (prevPage && prevPage.data && prevPage.data.displayedRecords) {
      const record = prevPage.data.displayedRecords[index];
      this.setData({ 
        record,
        loading: false
      });
      this.loadAppealDetail(record._id);
      this.setData({
        canModifyImage: this.canModifyImage(record),
        hasLoadedOnce: true
      })
    } else {
      this.showErrorAndBack('无法获取记录信息');
    }
  },
  
  loadFromCloud(recordId) {
    wx.showLoading({ title: '加载中...' });
    
    // 从云数据库查询记录
    const db = wx.cloud.database();
    db.collection('RunningRecords').doc(recordId).get({
      success: (res) => {
        wx.hideLoading();
        let record = res.data;
        
        // 处理create_time字段，转换为日期和时间分开显示
        if (record.create_time) {
          const createTime = new Date(record.create_time);
          
          // 获取日期部分 (YYYY-MM-DD)
          const year = createTime.getFullYear();
          const month = String(createTime.getMonth() + 1).padStart(2, '0');
          const day = String(createTime.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          // 获取时间部分 (HH:mm:ss) 24小时制
          const hours = String(createTime.getHours()).padStart(2, '0');
          const minutes = String(createTime.getMinutes()).padStart(2, '0');
          const seconds = String(createTime.getSeconds()).padStart(2, '0');
          const timeStr = `${hours}:${minutes}:${seconds}`;
          
          // 保存日期和时间到不同的字段
          record.create_date = dateStr;
          record.create_time_24 = timeStr;
        }
        
        this.setData({
          record: record,
          loading: false
        });
        this.setData({
          canModifyImage: this.canModifyImage(record),
          hasLoadedOnce: true
        })
        
        // 加载申诉详情
        this.loadAppealDetail(recordId);
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('加载记录失败', err);
        this.showErrorAndBack('云端数据获取失败')
      }
    });
  },
  
  showErrorAndBack(message) {
    wx.showToast({
      title: message,
      icon: 'none'
    });
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },

  loadAppealDetail(recordId) {
    const db = wx.cloud.database();
    db.collection('Appeals')
      .where({
        runningRecordId: recordId
      })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          const appealData = res.data[0];
          this.processAppealData(appealData);
        }
      })
      .catch(error => {
        console.error('加载申诉详情失败:', error);
      });
  },

  processAppealData(appealData) {
    let statusText = '申诉中';
    let statusClass = 'status-pending';
  
    if (appealData.status === 1) {
      statusText = '申诉被接受';
      statusClass = 'status-success';
    } else if (appealData.status === 2) {
      statusText = '申诉被驳回';
      statusClass = 'status-failed';
    }
  
    let formattedCreateTime = '';
    if (appealData.createTime) {
      const date = new Date(appealData.createTime);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      formattedCreateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds().padStart(2, '0'));
      formattedCreateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  
    let formattedAuditTime = '';
    if (appealData.auditTime) {
      const date = new Date(appealData.auditTime);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      formattedAuditTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  
    const processedAppeal = {
      ...appealData,
      statusText,
      statusClass,
      formattedCreateTime,
      formattedAuditTime
    };
  
    this.setData({
      appeal: processedAppeal
    });
  },

  /**
   * 预览申诉图片
   */
  previewAppealImage(e) {
    const index = e.currentTarget.dataset.index;
    const appealImages = this.data.appeal?.appealImages;
    if (appealImages && appealImages.length > 0) {
      wx.previewImage({
        current: appealImages[index],
        urls: appealImages
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
        content: '申诉尚未提交，确定要取消吗？',
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
      content: '提交后将重新审核您的跑步记录',
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
                title: res.result.message || '提交成功',
                icon: 'success',
                duration: 2000
              });
              
              // 申诉成功后更新状态为申诉中（3）
              this.setData({
                record: {
                  ...record,
                  status: 3
                },
                showAppealModal: false,
                appealReason: '',
                uploadedImages: []
              });
              
              // 重新加载申诉详情
              this.loadAppealDetail(record._id);
            } else {
              wx.showToast({
                title: '提交失败',
                icon: 'error',
                duration: 2000
              });
            }
          })
          .catch(error => {
            wx.hideLoading();
            console.error('申诉提交失败:', error);
            wx.showToast({
              title: '请稍后重试',
              icon: 'error',
              duration: 2000
            });
          });
        }
      }
    });
  },
  //判断是否可以修改截图
  canModifyImage(record) {
    if (!record) return false
    if (record.status !== 0) return false
    if (!record.create_time) return false
  
    // 1. 将记录的创建时间转换为北京时间
    const createTime = new Date(record.create_time)
    if (Number.isNaN(createTime.getTime())) return false
  
    // 获取北京时间
    const utcOffset = createTime.getTimezoneOffset() * 60 * 1000
    const beijingOffset = 8 * 60 * 60 * 1000
    const beijingCreateTime = new Date(createTime.getTime() + utcOffset + beijingOffset)
  
    // 2. 计算截止时间（基于北京时间）
    const deadline = new Date(beijingCreateTime)
    deadline.setDate(deadline.getDate() + 1)
    deadline.setHours(20, 0, 0, 0)
  
    // 3. 获取当前北京时间进行比较
    const now = new Date()
    const beijingNow = new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + beijingOffset)
  
    return beijingNow.getTime() <= deadline.getTime()
  },
  
  //跳转修改界面
  goToModifyImage() {
    const { record, canModifyImage } = this.data
  
    if (!record || !record._id || !canModifyImage) {
      wx.showToast({
        title: '当前记录不可修改',
        icon: 'none'
      })
      return
    }
  
    wx.navigateTo({
      url: `/pages/record-image-edit/record-image-edit?recordId=${record._id}`
    })
  },
  
  onShow() {
    if (this.data.hasLoadedOnce && this.data.record && this.data.record._id) {
      this.loadFromCloud(this.data.record._id)
    }
  },
  
  
});