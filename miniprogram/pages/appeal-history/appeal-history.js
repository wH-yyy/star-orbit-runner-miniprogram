// pages/appeal-history/appeal-history.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    appealList: [],
    loading: true,
    hasMore: true,
    page: 1,
    pageSize: 10
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.loadAppealHistory()
  },

  /**
   * 页面显示时重新加载数据
   */
  onShow() {
    console.log('=== 申诉历史页面显示，重新加载数据 ===')
    this.setData({
      appealList: [],
      loading: true,
      hasMore: true,
      page: 1
    })
    this.loadAppealHistory()
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (!this.data.loading && this.data.hasMore) {
      this.loadMoreAppeals()
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.setData({
      appealList: [],
      loading: true,
      hasMore: true,
      page: 1
    })
    this.loadAppealHistory()
    wx.stopPullDownRefresh()
  },

  /**
   * 加载申诉历史
   */
  loadAppealHistory() {
    console.log('=== 开始加载申诉历史 ===')
    this.setData({
      loading: true
    })

    const app = getApp()
    const openid = app.globalData.userInfo?.openid

    if (!openid) {
      console.error('加载申诉历史失败：openid不存在')
      this.setData({
        loading: false
      })
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/phone-login/phone-login'
        })
      }, 1500)
      return
    }

    const db = wx.cloud.database()
    const skip = (this.data.page - 1) * this.data.pageSize

    console.log('准备查询Appeals表，条件:', { openid: openid })
    db.collection('Appeals')
      .where({
        openid: openid
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        console.log('=== 加载申诉历史成功，结果:', res)
        const appealData = res.data
        
        // 处理申诉状态和时间
        const processedAppeals = appealData.map(item => {
          // 处理状态显示
          let statusText = '正在申诉中'
          let statusClass = 'status-pending'
          
          if (item.status === 1) {
            statusText = '记录通过'
            statusClass = 'status-success'
          } else if (item.status === 2) {
            statusText = '记录未通过'
            statusClass = 'status-failed'
          }
          
          // 处理时间显示
          const createTime = item.createTime ? new Date(item.createTime) : new Date()
          const formattedTime = createTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
          
          // 格式化日期和时间
          const formattedDate = createTime.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          })
          
          const formattedTimeOnly = createTime.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
          })
          
          return {
            ...item,
            statusText: statusText,
            statusClass: statusClass,
            formattedTime: formattedTime,
            formattedDate: formattedDate,
            formattedTimeOnly: formattedTimeOnly
          }
        })
        
        let newAppealList = []
        if (this.data.page === 1) {
          newAppealList = processedAppeals
        } else {
          newAppealList = [...this.data.appealList, ...processedAppeals]
        }
        
        this.setData({
          appealList: newAppealList,
          hasMore: processedAppeals.length === this.data.pageSize,
          loading: false
        })
        
        console.log('=== 申诉历史数据已设置:', this.data.appealList.length, '条记录 ===')
      })
      .catch(error => {
        console.error('=== 加载申诉历史失败:', error)
        this.setData({
          loading: false
        })
        wx.showToast({
          title: '加载申诉历史失败',
          icon: 'none'
        })
      })
  },

  /**
   * 加载更多申诉记录
   */
  loadMoreAppeals() {
    if (this.data.loading || !this.data.hasMore) {
      return
    }
    
    this.setData({
      loading: true,
      page: this.data.page + 1
    })
    
    this.loadAppealHistory()
  },

  /**
   * 查看关联的跑步记录
   */
  viewAppealDetail(e) {
    const appealItem = this.data.appealList.find(item => item._id === e.currentTarget.dataset.id)
    if (appealItem && appealItem.runningRecordId) {
      wx.navigateTo({
        url: `/pages/record-detail/record-detail?id=${appealItem.runningRecordId}`
      })
    } else {
      wx.showToast({
        title: '无法查看跑步记录',
        icon: 'none'
      })
    }
  },


})
