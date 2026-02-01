// pages/record/record.js
const userHelper = require('../utils/userInfoHelper');

Page({
  data: {
    userInfo: {},
    recordList: [],
    // 加载状态
    loading: true,
    // 是否有更多数据
    hasMore: true,
    // 分页参数
    page: 1,
    pageSize: 10
  },

  onLoad() {
    this.loadUserInfo()
    this.loadRecords()
  },

  /**
   * 页面显示时重新加载数据
   */
  onShow() {
    this.loadUserInfo()
    this.loadRecords()
  },

  loadUserInfo() {
    const userInfo = getApp().globalData.userInfo
    this.setData({
      userInfo: {
        ...userInfo,
        totalDistance: userInfo.totalDistance.toFixed(2),
        totalDuration: userInfo.totalDuration.toFixed(2)
      }
    })
  },

  /**
   * 加载跑步记录
   */
  loadRecords(loadMore = false) {
    if (!loadMore) {
      this.setData({ loading: true, page: 1 })
    }
    
    const app = getApp()
    const openid = app.globalData.userInfo?.openid
    
    if (!openid) {
      return
    }
    
    // 从数据库获取跑步记录
    const db = wx.cloud.database()
    const skip = loadMore ? (this.data.page - 1) * this.data.pageSize : 0
    db.collection('RunningRecords')
      .where({
        openid: openid
      })
      .orderBy('create_time', 'desc')
      .skip(skip)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        // 确保status字段为数字类型，并处理未通过原因
        const processedData = res.data.map(item => {
          if (item.status !== undefined) {
            item.status = parseInt(item.status);
          }
          
          // 处理未通过原因显示
          if (item.audit_reason) {
            let reason = item.audit_reason.toLowerCase();
            if (reason.includes('ocr') || reason.includes('识别')) {
              item.displayAuditReason = '学号和姓名不匹配';
            } else {
              item.displayAuditReason = item.audit_reason;
            }
          } else {
            item.displayAuditReason = '未提供具体原因';
          }
          
          return item;
        });
        
        let newRecordList = []
        if (loadMore) {
          newRecordList = [...this.data.recordList, ...processedData]
        } else {
          newRecordList = processedData;
        }
        
        this.setData({
          recordList: newRecordList,
          hasMore: res.data.length === this.data.pageSize,
          loading: false
        })
      })
      .catch(error => {
        console.error('加载跑步记录失败:', error)
        this.setData({ loading: false })
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      })
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    // 上拉加载更多
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreData();
    }
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
   * 加载更多数据
   */
  loadMoreData() {
    if (this.data.loading || !this.data.hasMore) {
      return
    }
    
    this.setData({ loading: true })
    this.data.page++
    this.loadRecords(true)
  },

  /**
   * 查看记录详情
   */
  viewRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/record-detail/record-detail?id=${id}`
    });
  },

  goToSubmit() {
    wx.switchTab({
      url: '/pages/submit/submit'
    })
  }
})