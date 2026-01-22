// pages/record/record.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    records: [], // 打卡记录列表
    hasMore: true // 是否还有更多数据
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 加载模拟数据
    this.loadMockData();
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
    // 每次显示页面时重新加载数据
    this.loadMockData();
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
    this.loadMockData();
    wx.stopPullDownRefresh();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    // 上拉加载更多
    if (this.data.hasMore) {
      this.loadMoreData();
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 加载模拟数据
   */
  loadMockData() {
    // 清空现有数据，显示加载状态
    this.setData({
      records: [],
      hasMore: false
    });
    
    // 模拟异步加载数据
    setTimeout(() => {
      // 模拟跑步打卡记录数据
      const mockRecords = [
        {
          id: '1',
          date: '2026-01-22',
          time: '07:30',
          type: 'gps',
          status: 'passed',
          distance: 5.2,
          duration: '28:35',
          pace: 5,
          paceSeconds: 30,
          steps: 6850
        },
        {
          id: '2',
          date: '2026-01-21',
          time: '18:45',
          type: 'manual',
          status: 'failed',
          failReason: '跑步距离未达到最低要求（需≥3km）',
          distance: 2.8,
          duration: '16:20',
          pace: 5,
          paceSeconds: 50,
          steps: 3800
        },
        {
          id: '3',
          date: '2026-01-20',
          time: '06:50',
          type: 'gps',
          status: 'passed',
          distance: 7.5,
          duration: '42:15',
          pace: 5,
          paceSeconds: 40,
          steps: 9800
        },
        {
          id: '4',
          date: '2026-01-19',
          time: '19:20',
          type: 'gps',
          status: 'pending',
          distance: 4.1,
          duration: '23:45',
          pace: 5,
          paceSeconds: 55,
          steps: 5400
        },
        {
          id: '5',
          date: '2026-01-18',
          time: '07:15',
          type: 'manual',
          status: 'passed',
          distance: 3.5,
          duration: '20:10',
          pace: 5,
          paceSeconds: 45,
          steps: 4600
        }
      ];

      this.setData({
        records: mockRecords,
        hasMore: true
      });
    }, 500);
  },

  /**
   * 加载更多数据
   */
  loadMoreData() {
    // 模拟加载更多数据
    setTimeout(() => {
      const newRecords = [
        {
          id: `more-${Date.now()}-1`,
          date: '2026-01-17',
          time: '18:30',
          type: 'gps',
          status: 'passed',
          distance: 6.3,
          duration: '35:20',
          pace: 5,
          paceSeconds: 35,
          steps: 8200
        },
        {
          id: `more-${Date.now()}-2`,
          date: '2026-01-16',
          time: '07:00',
          type: 'gps',
          status: 'failed',
          failReason: '跑步时长未达到最低要求（需≥15分钟）',
          distance: 3.2,
          duration: '14:50',
          pace: 4,
          paceSeconds: 45,
          steps: 4200
        }
      ];

      this.setData({
        records: [...this.data.records, ...newRecords],
        hasMore: false // 模拟没有更多数据
      });
    }, 1000);
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


})