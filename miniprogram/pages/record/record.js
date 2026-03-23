Page({
  data: {
    userInfo: {},
    // 记录状态统计
    recordStats: {
      passed: 0,
      pending: 0,
      failed: 0,
      appeal: 0
    },
    // 所有记录（从数据库获取的全部记录）
    allRecords: [],
    // 当前显示的记录（筛选后）
    displayedRecords: [],
    // 加载状态
    loading: true,

    // 筛选面板是否可见
    showFilterPanel: false,
    // 筛选条件
    filterDateStart: '',
    filterDateEnd: '',
    filterStatus: ''
  },

  onLoad() {
    const app = getApp()
    // 登录检查
    if (!app.globalData.userInfo.openid) {
      wx.showToast({
        icon: 'error',
        title: '请先登录',
      })
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/phone-login/phone-login',
        })
      }, 1000)
      return
    }
    // 完善个人信息检查
    if (!app.globalData.userInfo.class_name || !app.globalData.userInfo.college || !app.globalData.userInfo.gender || !app.globalData.userInfo.name || !app.globalData.userInfo.campus) {
      wx.showToast({
        icon: 'error',
        title: '请完善个人信息',
      })
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/finish-info/finish-info',
        })
      }, 1000)
      return
    }
    this.loadUserInfo()
    this.loadAllRecords()
  },

  async onPullDownRefresh() {
    this.setData({
      loading: true
    })
    try {
      const app = getApp()
      const db = wx.cloud.database()
      const res = await db.collection('Users')
        .doc(app.globalData.userInfo._id)
        .get()
      if (res.data) {
        const userInfo = {
          ...res.data,
          avatar: res.data.gender === '男' ? '/images/male-avatar.jpg' : '/images/female-avatar.jpg'
        }
        app.globalData.userInfo = userInfo
        wx.setStorageSync('userInfo', userInfo)
      }
    } catch (error) {
      wx.showToast({
        title: '刷新失败，请检查网络连接状态',
        icon: 'error',
      })
      this.setData({
        loading: false
      })
      return
    }
    this.loadUserInfo()
    this.loadAllRecords()
    wx.stopPullDownRefresh()
  },

  loadUserInfo() {
    const userInfo = getApp().globalData.userInfo
    this.setData({
      userInfo
    })
  },

  /**
   * 加载所有跑步记录（一次性加载全部）
   */
  loadAllRecords() {
    this.setData({
      loading: true
    })

    const app = getApp()
    const openid = app.globalData.userInfo.openid

    // 从数据库获取所有跑步记录
    const db = wx.cloud.database()
    db.collection('RunningRecords')
      .where({
        openid: openid
      })
      .orderBy('create_time', 'desc')
      .get()
      .then(res => {
        // 处理数据
        const processedData = res.data.map(item => {
          // 转换创建时间格式为24小时制，日期和时间分行显示
          if (item.create_time) {
            const createTime = new Date(item.create_time);

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
            item.create_date = dateStr;
            item.create_time_24 = timeStr;
            // 保存时间戳用于筛选
            item.timestamp = createTime.getTime();
          }
          return item;
        });

        // 统计各状态记录数（基于全部记录）
        const recordStats = {
          passed: 0,
          pending: 0,
          failed: 0,
          appeal: 0
        }
        processedData.forEach(r => {
          const status = typeof r.status === 'number' ? r.status : parseInt(r.status, 10)
          if (status === 1) recordStats.passed += 1
          else if (status === 0) recordStats.pending += 1
          else if (status === 2) recordStats.failed += 1
          else if (status === 3) recordStats.appeal += 1
        })

        this.setData({
          allRecords: processedData,
          displayedRecords: processedData, // 初始显示全部记录
          recordStats,
          loading: false
        })
      })
      .catch(error => {
        console.error('加载跑步记录失败:', error)
        this.setData({
          loading: false
        })
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      })
  },

  /**
   * 日期筛选 - 开始日期变化
   */
  onDateStartChange(e) {
    const date = e.detail.value;
    if (this.data.filterDateEnd && new Date(date) > new Date(this.data.filterDateEnd)) {
      wx.showToast({
        title: '开始日期不能晚于结束日期',
        icon: 'none'
      })
      return;
    }
    this.setData({
      filterDateStart: date
    });
  },

  /**
   * 日期筛选 - 结束日期变化
   */
  onDateEndChange(e) {
    const date = e.detail.value;
    if (this.data.filterDateStart && new Date(date) < new Date(this.data.filterDateStart)) {
      wx.showToast({
        title: '结束日期不能早于开始日期',
        icon: 'none'
      })
      return;
    }
    this.setData({
      filterDateEnd: date
    });
  },

  /**
   * 状态筛选变化
   */
  changeStatus(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({
      filterStatus: status
    });
  },

  // 切换筛选面板显示/隐藏
  toggleFilterPanel() {
    this.setData({
      showFilterPanel: !this.data.showFilterPanel
    });
  },

  /**
   * 应用筛选
   */
  applyFilter() {
    if (this.data.allRecords.length === 0) {
      return;
    }

    let filteredRecords = [...this.data.allRecords];

    // 应用状态筛选
    if (this.data.filterStatus !== '') {
      const status = parseInt(this.data.filterStatus);
      filteredRecords = filteredRecords.filter(record => record.status === status);
    }

    // 应用日期筛选
    if (this.data.filterDateStart || this.data.filterDateEnd) {
      const startDate = this.data.filterDateStart ? new Date(this.data.filterDateStart).getTime() : null;
      const endDate = this.data.filterDateEnd ? new Date(this.data.filterDateEnd + 'T23:59:59').getTime() : null;

      filteredRecords = filteredRecords.filter(record => {
        const recordTime = record.timestamp;

        if (startDate && endDate) {
          return recordTime >= startDate && recordTime <= endDate;
        } else if (startDate) {
          return recordTime >= startDate;
        } else if (endDate) {
          return recordTime <= endDate;
        }
        return true;
      });
    }

    this.setData({
      displayedRecords: filteredRecords,
      showFilterPanel: false
    });
  },

  /**
   * 重置筛选
   */
  resetFilter() {
    this.setData({
      showFilterPanel: false,
      filterDateStart: '',
      filterDateEnd: '',
      filterStatus: '',
      displayedRecords: this.data.allRecords
    });
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const images = e.currentTarget.dataset.images
    const index = e.currentTarget.dataset.index
    wx.previewImage({
      urls: images,
      current: images[index]
    })
  },

  /**
   * 查看记录详情
   */
  viewRecord(e) {
    const index = e.currentTarget.dataset.index;
    wx.navigateTo({
      url: `/pages/record-detail/record-detail?index=${index}`
    });
  },

  goToSubmit() {
    wx.switchTab({
      url: '/pages/submit/submit'
    })
  }
})